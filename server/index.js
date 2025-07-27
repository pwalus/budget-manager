import express from "express";
import cors from "cors";
import pkg from "pg";
import dotenv from "dotenv";
import axios from "axios";

const { Pool } = pkg;
dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// Database configuration
const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || "budget_manager",
  user: process.env.DB_USER || "budget_user",
  password: process.env.DB_PASSWORD || "budget_password",
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// Authentication
app.post("/api/auth/signin", (req, res) => {
  const { password } = req.body;
  const correctPassword = process.env.APP_PASSWORD;

  if (password === correctPassword) {
    res.json({ success: true, message: "Authentication successful" });
  } else {
    res.status(401).json({ success: false, message: "Invalid password" });
  }
});

// Accounts endpoints
app.get("/api/accounts", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM accounts ORDER BY created_at ASC");
    const balancesResult = await pool.query("SELECT * FROM get_account_balances()");
    const investmentBalancesResult = await pool.query("SELECT * FROM get_investment_account_balances()");

    const accountsWithBalances = result.rows.map((account) => {
      let balance = 0;

      if (account.type === "investment") {
        // For investment accounts, use the investment balance calculation
        const investmentBalance = investmentBalancesResult.rows.find((b) => b.account_id === account.id);
        balance = investmentBalance ? parseFloat(investmentBalance.balance) : 0;
      } else {
        // For regular accounts, use transaction-based balance
        const balanceObj = balancesResult.rows.find((b) => b.account_id === account.id);
        balance = balanceObj ? parseFloat(balanceObj.balance) : 0;
      }

      return {
        ...account,
        balance: balance,
      };
    });

    res.json(accountsWithBalances);
  } catch (error) {
    console.error("Error fetching accounts:", error);
    res.status(500).json({ error: "Failed to fetch accounts" });
  }
});

app.post("/api/accounts", async (req, res) => {
  try {
    const { name, type, currency } = req.body;
    const result = await pool.query("INSERT INTO accounts (name, type, currency) VALUES ($1, $2, $3) RETURNING *", [
      name,
      type,
      currency,
    ]);
    res.json({ ...result.rows[0], balance: 0 });
  } catch (error) {
    console.error("Error creating account:", error);
    res.status(500).json({ error: "Failed to create account" });
  }
});

app.delete("/api/accounts/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM accounts WHERE id = $1", [id]);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting account:", error);
    res.status(500).json({ error: "Failed to delete account" });
  }
});

// Transactions endpoints
app.get("/api/transactions", async (req, res) => {
  try {
    const { tagId, search, status } = req.query;

    let query = "SELECT * FROM transactions";
    let params = [];
    let paramCount = 1;
    let whereClauses = [];

    // Add tag filtering if tagId is provided
    if (tagId && tagId !== "all") {
      // Get all child tag IDs for the selected tag
      const childTagsQuery = `
        WITH RECURSIVE tag_tree AS (
          SELECT id FROM tags WHERE id = $1
          UNION ALL
          SELECT t.id FROM tags t INNER JOIN tag_tree tt ON t.parent_id = tt.id
        )
        SELECT id FROM tag_tree
      `;
      const childTagsResult = await pool.query(childTagsQuery, [tagId]);
      const allowedTagIds = childTagsResult.rows.map((row) => row.id);

      if (allowedTagIds.length > 0) {
        whereClauses.push(`tags && $${paramCount}::uuid[]`);
        params.push(allowedTagIds);
        paramCount += 1;
      }
    }

    // Add search filter (description/title)
    if (search && search.trim() !== "") {
      whereClauses.push(`LOWER(description) LIKE $${paramCount}`);
      params.push(`%${search.toLowerCase()}%`);
      paramCount += 1;
    }

    // Add status filter
    if (status && status !== "all") {
      whereClauses.push(`status = $${paramCount}`);
      params.push(status);
      paramCount += 1;
    }

    if (whereClauses.length > 0) {
      query += " WHERE " + whereClauses.join(" AND ");
    }

    query += " ORDER BY date DESC";

    const result = await pool.query(query, params);

    // Convert amount from string to number and add transfer_direction
    const transactions = result.rows.map((transaction) => ({
      ...transaction,
      amount: parseFloat(transaction.amount),
      transfer_direction:
        transaction.type === "transfer" ? (parseFloat(transaction.amount) < 0 ? "outgoing" : "incoming") : undefined,
    }));
    res.json(transactions);
  } catch (error) {
    console.error("Error fetching transactions:", error);
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});

app.post("/api/transactions", async (req, res) => {
  try {
    const { account_id, date, description, amount, type, status, tags, from_account_id, to_account_id } = req.body;

    if (type === "transfer") {
      // For transfers, create two linked transactions
      if (!from_account_id || !to_account_id) {
        return res.status(400).json({ error: "Transfer transactions require both from_account_id and to_account_id" });
      }

      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        // Create the outgoing transaction (debit from source account)
        const outgoingResult = await client.query(
          "INSERT INTO transactions (account_id, date, description, amount, type, status, tags, from_account_id, to_account_id, linked_transaction_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *",
          [
            from_account_id,
            date,
            description,
            -Math.abs(amount),
            type,
            status,
            tags,
            from_account_id,
            to_account_id,
            null,
          ]
        );

        // Create the incoming transaction (credit to destination account)
        const incomingResult = await client.query(
          "INSERT INTO transactions (account_id, date, description, amount, type, status, tags, from_account_id, to_account_id, linked_transaction_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *",
          [to_account_id, date, description, Math.abs(amount), type, status, tags, from_account_id, to_account_id, null]
        );

        // Link the transactions to each other
        await client.query("UPDATE transactions SET linked_transaction_id = $1 WHERE id = $2", [
          incomingResult.rows[0].id,
          outgoingResult.rows[0].id,
        ]);
        await client.query("UPDATE transactions SET linked_transaction_id = $1 WHERE id = $2", [
          outgoingResult.rows[0].id,
          incomingResult.rows[0].id,
        ]);

        await client.query("COMMIT");

        // Return the outgoing transaction as the primary one
        const transaction = {
          ...outgoingResult.rows[0],
          amount: parseFloat(outgoingResult.rows[0].amount),
        };
        res.json(transaction);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    } else {
      // For income and expense transactions, create normally
      const result = await pool.query(
        "INSERT INTO transactions (account_id, date, description, amount, type, status, tags, from_account_id, to_account_id, linked_transaction_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *",
        [
          account_id,
          date,
          description,
          amount,
          type,
          status,
          tags,
          from_account_id || null,
          to_account_id || null,
          null,
        ]
      );
      // Convert amount from string to number
      const transaction = {
        ...result.rows[0],
        amount: parseFloat(result.rows[0].amount),
      };
      res.json(transaction);
    }
  } catch (error) {
    console.error("Error creating transaction:", error);
    res.status(500).json({ error: "Failed to create transaction" });
  }
});

app.put("/api/transactions/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Get the current transaction to check if it's linked
    const currentResult = await pool.query("SELECT * FROM transactions WHERE id = $1", [id]);
    if (currentResult.rows.length === 0) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    const currentTransaction = currentResult.rows[0];

    const setParts = [];
    const values = [];
    let paramCount = 1;

    Object.entries(updates).forEach(([key, value]) => {
      if (key !== "id" && key !== "created_at" && key !== "updated_at" && key !== "linked_transaction_id") {
        setParts.push(`${key} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    });

    if (setParts.length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      values.push(id);
      const result = await client.query(
        `UPDATE transactions SET ${setParts.join(", ")}, updated_at = NOW() WHERE id = $${paramCount} RETURNING *`,
        values
      );

      // If this is a linked transaction (transfer), update the linked transaction too
      if (currentTransaction.linked_transaction_id) {
        const linkedUpdates = { ...updates };

        // For transfers, mirror certain changes but flip the amount
        if (updates.amount !== undefined) {
          linkedUpdates.amount = -parseFloat(updates.amount);
        }

        const linkedSetParts = [];
        const linkedValues = [];
        let linkedParamCount = 1;

        Object.entries(linkedUpdates).forEach(([key, value]) => {
          if (key !== "id" && key !== "created_at" && key !== "updated_at" && key !== "linked_transaction_id") {
            linkedSetParts.push(`${key} = $${linkedParamCount}`);
            linkedValues.push(value);
            linkedParamCount++;
          }
        });

        if (linkedSetParts.length > 0) {
          linkedValues.push(currentTransaction.linked_transaction_id);
          await client.query(
            `UPDATE transactions SET ${linkedSetParts.join(", ")}, updated_at = NOW() WHERE id = $${linkedParamCount}`,
            linkedValues
          );
        }
      }

      await client.query("COMMIT");

      // Convert amount from string to number
      const transaction = {
        ...result.rows[0],
        amount: parseFloat(result.rows[0].amount),
      };
      res.json(transaction);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error updating transaction:", error);
    res.status(500).json({ error: "Failed to update transaction" });
  }
});

app.delete("/api/transactions/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Get the transaction to check if it's linked
    const currentResult = await pool.query("SELECT linked_transaction_id FROM transactions WHERE id = $1", [id]);
    if (currentResult.rows.length === 0) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    const linkedTransactionId = currentResult.rows[0].linked_transaction_id;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Delete the main transaction
      await client.query("DELETE FROM transactions WHERE id = $1", [id]);

      // If there's a linked transaction, delete it too
      if (linkedTransactionId) {
        await client.query("DELETE FROM transactions WHERE id = $1", [linkedTransactionId]);
      }

      await client.query("COMMIT");
      res.json({ success: true });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error deleting transaction:", error);
    res.status(500).json({ error: "Failed to delete transaction" });
  }
});

app.post("/api/transactions/bulk-delete", async (req, res) => {
  try {
    const { ids } = req.body;
    await pool.query("DELETE FROM transactions WHERE id = ANY($1)", [ids]);
    res.json({ success: true });
  } catch (error) {
    console.error("Error bulk deleting transactions:", error);
    res.status(500).json({ error: "Failed to delete transactions" });
  }
});

app.post("/api/transactions/bulk-import", async (req, res) => {
  try {
    const { transactions, accountId } = req.body;

    if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
      return res.status(400).json({ error: "No transactions provided" });
    }

    if (!accountId) {
      return res.status(400).json({ error: "Account ID is required" });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const importedTransactions = [];
      let importedCount = 0;
      let duplicatedCount = 0;
      let skippedCount = 0;

      for (const transaction of transactions) {
        try {
          // Parse amount - handle Polish number format (comma as decimal separator)
          let amount = transaction.amount;
          if (typeof amount === "string") {
            // Remove quotes and replace comma with dot for decimal parsing
            amount = amount.replace(/"/g, "").replace(",", ".");
          }
          amount = parseFloat(amount);

          // Determine transaction type based on amount
          const type = amount >= 0 ? "income" : "expense";

          // Parse date - handle different date formats and convert to datetime
          let date = transaction.date;
          if (date.includes("T") || date.includes("Z")) {
            // Date is already in ISO datetime format
            date = date;
          } else if (date.includes("-")) {
            // Check if it's already in YYYY-MM-DD format
            if (date.match(/^\d{4}-\d{2}-\d{2}$/)) {
              // Date is in YYYY-MM-DD format, convert to datetime at midnight
              date = `${date}T00:00:00.000Z`;
            } else {
              // Assume DD-MM-YYYY format (Polish format)
              const parts = date.split("-");
              const isoDate = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
              date = `${isoDate}T00:00:00.000Z`;
            }
          } else if (date.includes("/")) {
            // Convert DD/MM/YYYY to YYYY-MM-DD then to datetime
            const parts = date.split("/");
            const isoDate = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
            date = `${isoDate}T00:00:00.000Z`;
          } else {
            // Assume DD-MM-YYYY format
            const parts = date.split("-");
            const isoDate = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
            date = `${isoDate}T00:00:00.000Z`;
          }

          // Check for duplicate transaction using similarity check
          // Look for transactions with the same amount and similar description
          const duplicateCheck = await client.query(
            `SELECT id, description FROM transactions 
             WHERE account_id = $1 AND amount = $2 AND ABS(EXTRACT(EPOCH FROM (date - $3::timestamp))) < 86400 * 7
             ORDER BY date DESC LIMIT 10`,
            [accountId, amount, date]
          );

          // Check if any existing transaction has a description that contains or is contained in the new description
          let isDuplicate = false;
          const newDescription = (transaction.description || "").toLowerCase().trim();

          for (const existingTx of duplicateCheck.rows) {
            const existingDescription = (existingTx.description || "").toLowerCase().trim();

            // Check if descriptions contain each other (allowing for some variation)
            if (existingDescription.length > 3 && newDescription.length > 3) {
              if (existingDescription.includes(newDescription) || newDescription.includes(existingDescription)) {
                isDuplicate = true;
                break;
              }
            }
          }

          // Determine status based on duplicate check
          const status = isDuplicate ? "duplicated" : "pending";

          const result = await client.query(
            `INSERT INTO transactions (account_id, date, description, amount, type, status) 
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [accountId, date, transaction.description || "", amount, type, status]
          );

          importedTransactions.push({
            ...result.rows[0],
            amount: parseFloat(result.rows[0].amount),
          });

          if (status === "duplicated") {
            duplicatedCount++;
          } else {
            importedCount++;
          }
        } catch (error) {
          console.error(`Error importing transaction: ${transaction.description}`, error);
          skippedCount++;
        }
      }

      await client.query("COMMIT");

      res.json({
        success: true,
        importedCount,
        duplicatedCount,
        skippedCount,
        transactions: importedTransactions,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error bulk importing transactions:", error);
    res.status(500).json({ error: "Failed to import transactions" });
  }
});

// Tags endpoints
app.get("/api/tags", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM tags ORDER BY created_at ASC");
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching tags:", error);
    res.status(500).json({ error: "Failed to fetch tags" });
  }
});

app.post("/api/tags", async (req, res) => {
  try {
    const { name, parent_id, color } = req.body;
    const result = await pool.query("INSERT INTO tags (name, parent_id, color) VALUES ($1, $2, $3) RETURNING *", [
      name,
      parent_id || null,
      color,
    ]);
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error creating tag:", error);
    res.status(500).json({ error: "Failed to create tag" });
  }
});

app.put("/api/tags/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const setParts = [];
    const values = [];
    Object.entries(updates).forEach(([key, value]) => {
      if (key !== "id" && key !== "created_at" && key !== "updated_at") {
        setParts.push(`${key} = $${setParts.length + 1}`);
        values.push(value);
      }
    });

    if (setParts.length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    // Explicitly calculate the index for the id parameter
    const idParamIndex = values.length + 1;
    values.push(id);
    const result = await pool.query(
      `UPDATE tags SET ${setParts.join(", ")}, updated_at = NOW() WHERE id = $${idParamIndex} RETURNING *`,
      values
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error updating tag:", error);
    res.status(500).json({ error: "Failed to update tag" });
  }
});

app.delete("/api/tags/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM tags WHERE id = $1", [id]);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting tag:", error);
    res.status(500).json({ error: "Failed to delete tag" });
  }
});

// Net Worth Trend endpoint
app.get("/api/net-worth-trend", async (req, res) => {
  try {
    const result = await pool.query(`
      WITH months AS (
        SELECT (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month - 1 day') - INTERVAL '1 month' * gs AS month_end
        FROM generate_series(0, 11) AS gs
      ),
      transaction_net_worth_per_month AS (
        SELECT
          m.month_end,
          SUM(
            CASE
              WHEN t.type = 'income' THEN t.amount
              WHEN t.type = 'expense' THEN -ABS(t.amount)
              WHEN t.type = 'transfer' AND t.account_id = t.from_account_id THEN -ABS(t.amount)
              WHEN t.type = 'transfer' AND t.account_id = t.to_account_id THEN ABS(t.amount)
              ELSE 0
            END
          ) AS transaction_net_worth
        FROM months m
        LEFT JOIN transactions t
          ON t.status = 'cleared'
          AND t.date <= m.month_end
        GROUP BY m.month_end
      ),
      investment_worth_per_month AS (
        SELECT
          m.month_end,
          COALESCE(SUM(awh.amount * awh.price), 0) AS investment_worth
        FROM months m
        LEFT JOIN investment_accounts ia ON ia.account_id IS NOT NULL
        LEFT JOIN investment_assets iaa ON ia.id = iaa.account_id
        LEFT JOIN LATERAL (
          SELECT amount, price
          FROM asset_worth_history awh
          WHERE awh.asset_id = iaa.id
          AND awh.date <= m.month_end
          ORDER BY awh.date DESC
          LIMIT 1
        ) awh ON true
        GROUP BY m.month_end
      )
      SELECT
        to_char(tnw.month_end, 'Mon ''YY') AS label,
        COALESCE(tnw.transaction_net_worth, 0) + COALESCE(iw.investment_worth, 0) AS value
      FROM transaction_net_worth_per_month tnw
      LEFT JOIN investment_worth_per_month iw ON tnw.month_end = iw.month_end
      ORDER BY tnw.month_end;
    `);
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching net worth trend:", error);
    res.status(500).json({ error: "Failed to fetch net worth trend" });
  }
});

// Temporary endpoint to fix existing investment account linking
app.post("/api/fix-investment-accounts", async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Find investment accounts that don't have account_id set
      const investmentAccounts = await client.query("SELECT * FROM investment_accounts WHERE account_id IS NULL");

      for (const invAccount of investmentAccounts.rows) {
        // Find the corresponding main account by name
        const mainAccount = await client.query("SELECT * FROM accounts WHERE name = $1 AND type = 'investment'", [
          invAccount.name,
        ]);

        if (mainAccount.rows.length > 0) {
          // Update the investment account to link to the main account
          await client.query("UPDATE investment_accounts SET account_id = $1 WHERE id = $2", [
            mainAccount.rows[0].id,
            invAccount.id,
          ]);
        }
      }

      await client.query("COMMIT");
      res.json({ success: true, message: "Investment accounts linked successfully" });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error fixing investment accounts:", error);
    res.status(500).json({ error: "Failed to fix investment accounts" });
  }
});

// --- Investment Account Endpoints ---

// Create investment account
app.post("/api/investment-accounts", async (req, res) => {
  try {
    const { user_id, name, currency } = req.body;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // First create the main account entry
      const accountResult = await client.query(
        "INSERT INTO accounts (name, type, currency) VALUES ($1, $2, $3) RETURNING *",
        [name, "investment", currency || "USD"]
      );

      // Then create the investment account entry
      const investmentResult = await client.query(
        "INSERT INTO investment_accounts (account_id, user_id, name) VALUES ($1, $2, $3) RETURNING *",
        [accountResult.rows[0].id, user_id || null, name]
      );

      await client.query("COMMIT");

      res.json({
        ...investmentResult.rows[0],
        account: accountResult.rows[0],
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error creating investment account:", error);
    res.status(500).json({ error: "Failed to create investment account" });
  }
});

// Get all investment accounts and their assets
app.get("/api/investment-accounts", async (req, res) => {
  try {
    const accountsResult = await pool.query(`
      SELECT ia.*, a.name as account_name, a.currency, a.balance as account_balance
      FROM investment_accounts ia
      JOIN accounts a ON ia.account_id = a.id
      ORDER BY ia.created_at ASC
    `);
    const assetsResult = await pool.query("SELECT * FROM investment_assets");
    const accounts = accountsResult.rows.map((account) => ({
      ...account,
      assets: assetsResult.rows.filter((a) => a.account_id === account.id),
    }));
    res.json(accounts);
  } catch (error) {
    console.error("Error fetching investment accounts:", error);
    res.status(500).json({ error: "Failed to fetch investment accounts" });
  }
});

// Endpoint: GET /api/investment-accounts/:id/worth-history?timeframe=30d|12m
app.get("/api/investment-accounts/:id/worth-history", async (req, res) => {
  try {
    const { id } = req.params;
    const { timeframe } = req.query;
    // Get all assets for the account
    const assetsResult = await pool.query("SELECT * FROM investment_assets WHERE account_id = $1", [id]);
    const assets = assetsResult.rows;
    if (assets.length === 0) return res.json([]);
    // Determine date range
    const today = new Date();
    let startDate;
    if (timeframe === "12m") {
      startDate = new Date(today.getFullYear(), today.getMonth() - 11, 1);
    } else {
      // Default to 30d
      startDate = new Date(today);
      startDate.setDate(today.getDate() - 29);
    }
    // Build a list of dates in the range
    const dates = [];
    let d = new Date(startDate);
    while (d <= today) {
      dates.push(new Date(d));
      if (timeframe === "12m") {
        d.setMonth(d.getMonth() + 1);
      } else {
        d.setDate(d.getDate() + 1);
      }
    }
    // For each date, sum worth of all assets (amount * price on that date)
    const worthHistory = [];
    for (const date of dates) {
      let total = 0;
      for (const asset of assets) {
        // Get the latest worth snapshot for the asset on or before this date
        const worthResult = await pool.query(
          `SELECT amount, price FROM asset_worth_history WHERE asset_id = $1 AND date <= $2 ORDER BY date DESC LIMIT 1`,
          [asset.id, date.toISOString()]
        );
        let amount, price;
        if (worthResult.rows.length > 0) {
          amount = parseFloat(worthResult.rows[0].amount);
          price = parseFloat(worthResult.rows[0].price);
        } else {
          // Fallback to current amount and price 0
          amount = parseFloat(asset.amount);
          price = 0;
        }
        if (price != null && amount != null) {
          total += amount * price;
        }
      }
      worthHistory.push({ date: date.toISOString(), value: total });
    }
    res.json(worthHistory);
  } catch (error) {
    console.error("Error fetching worth history:", error);
    res.status(500).json({ error: "Failed to fetch worth history" });
  }
});

// --- Asset API Abstraction ---
const assetAPIs = {
  coinmarketcap: {
    async searchAssets(query) {
      const url = "https://pro-api.coinmarketcap.com/v1/cryptocurrency/map";
      const resp = await axios.get(url, {
        params: { symbol: query },
        headers: { "X-CMC_PRO_API_KEY": process.env.COINMARKETCAP_API_KEY },
      });
      return resp.data.data.map((item) => ({
        api_source: "coinmarketcap",
        asset_id: item.id.toString(),
        symbol: item.symbol,
        name: item.name,
      }));
    },
    async getPrice(asset_id, currency) {
      const url = "https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest";
      const resp = await axios.get(url, {
        params: { id: asset_id, convert: currency },
        headers: { "X-CMC_PRO_API_KEY": process.env.COINMARKETCAP_API_KEY },
      });
      const data = resp.data.data[asset_id];
      return data && data.quote && data.quote[currency] ? data.quote[currency].price : null;
    },
  },
  // Add more APIs here later
};

// Search for asset (across all APIs)
app.post("/api/investment-assets/search", async (req, res) => {
  try {
    const { query } = req.body;
    let results = [];
    for (const apiName in assetAPIs) {
      const api = assetAPIs[apiName];
      const found = await api.searchAssets(query);
      results = results.concat(found);
    }
    res.json(results);
  } catch (error) {
    console.error("Error searching for assets:", error);
    res.status(500).json({ error: "Failed to search for assets" });
  }
});

// Add asset to investment account
app.post("/api/investment-accounts/:accountId/assets", async (req, res) => {
  try {
    const { accountId } = req.params;
    const { api_source, asset_id, symbol, name, amount } = req.body;
    const result = await pool.query(
      `INSERT INTO investment_assets (account_id, api_source, asset_id, symbol, name, amount) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [accountId, api_source, asset_id, symbol, name, amount]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error adding asset:", error);
    res.status(500).json({ error: "Failed to add asset" });
  }
});

// Edit asset amount
app.patch("/api/investment-assets/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { amount } = req.body;
    const result = await pool.query(
      `UPDATE investment_assets SET amount = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [amount, id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error updating asset amount:", error);
    res.status(500).json({ error: "Failed to update asset amount" });
  }
});

// Delete asset
app.delete("/api/investment-assets/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`DELETE FROM investment_assets WHERE id = $1 RETURNING *`, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Asset not found" });
    }
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting asset:", error);
    res.status(500).json({ error: "Failed to delete asset" });
  }
});

// Update asset price (with daily caching)
app.get("/api/investment-assets/:id/price", async (req, res) => {
  try {
    const { id } = req.params;
    // Get asset and parent account
    const assetResult = await pool.query("SELECT * FROM investment_assets WHERE id = $1", [id]);
    if (assetResult.rows.length === 0) return res.status(404).json({ error: "Asset not found" });
    const asset = assetResult.rows[0];

    const accountResult = await pool.query(
      `
      SELECT a.currency 
      FROM investment_accounts ia
      JOIN accounts a ON ia.account_id = a.id
      WHERE ia.id = $1
    `,
      [asset.account_id]
    );

    const accountCurrency = accountResult.rows[0]?.currency || "USD";
    const today = new Date();
    // Fetch price from API or cache
    let price = asset.last_price;
    if (
      asset.last_price &&
      asset.last_price_date &&
      asset.last_price_date.toISOString().slice(0, 10) === today.toISOString().slice(0, 10)
    ) {
      // No need to update price, just use last_price
    } else {
      const api = assetAPIs[asset.api_source];
      if (!api) return res.status(400).json({ error: "Unknown API source" });
      price = await api.getPrice(asset.asset_id, accountCurrency);
      if (price == null) return res.status(404).json({ error: "Price not found" });
      await pool.query(
        `UPDATE investment_assets SET last_price = $1, last_price_date = $2, updated_at = NOW() WHERE id = $3`,
        [price, today, id]
      );
    }
    // Insert into asset_worth_history (amount and price)
    await pool.query(
      `INSERT INTO asset_worth_history (asset_id, date, amount, price, currency) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (asset_id, date) DO UPDATE SET amount = $3, price = $4, currency = $5`,
      [id, today.toISOString(), asset.amount, price, accountCurrency]
    );
    res.json({ price, date: today.toISOString(), currency: accountCurrency });
  } catch (error) {
    console.error("Error fetching asset price:", error);
    res.status(500).json({ error: "Failed to fetch asset price" });
  }
});

// Manually update asset price
app.patch("/api/investment-assets/:id/price", async (req, res) => {
  try {
    const { id } = req.params;
    const { price, date } = req.body;

    // Get asset and parent account
    const assetResult = await pool.query("SELECT * FROM investment_assets WHERE id = $1", [id]);
    if (assetResult.rows.length === 0) return res.status(404).json({ error: "Asset not found" });
    const asset = assetResult.rows[0];

    const accountResult = await pool.query(
      `
      SELECT a.currency 
      FROM investment_accounts ia
      JOIN accounts a ON ia.account_id = a.id
      WHERE ia.id = $1
    `,
      [asset.account_id]
    );

    const accountCurrency = accountResult.rows[0]?.currency || "USD";
    const priceDate = date || new Date().toISOString();

    // Update the asset's last price
    await pool.query(
      `UPDATE investment_assets SET last_price = $1, last_price_date = $2, updated_at = NOW() WHERE id = $3`,
      [price, priceDate, id]
    );

    // Insert into asset_worth_history
    await pool.query(
      `INSERT INTO asset_worth_history (asset_id, date, amount, price, currency) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (asset_id, date) DO UPDATE SET amount = $3, price = $4, currency = $5`,
      [id, priceDate, asset.amount, price, accountCurrency]
    );

    res.json({ price, date: priceDate, currency: accountCurrency });
  } catch (error) {
    console.error("Error updating asset price:", error);
    res.status(500).json({ error: "Failed to update asset price" });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error("Server error:", error);
  res.status(500).json({ error: "Internal server error" });
});

// Start server
app.listen(port, () => {
  console.log(`Budget Manager API server running on port ${port}`);
  console.log(`Health check available at http://localhost:${port}/health`);
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("SIGTERM received, closing server...");
  await pool.end();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("SIGINT received, closing server...");
  await pool.end();
  process.exit(0);
});
