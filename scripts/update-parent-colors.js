const { Pool } = require("pg");

// Database configuration
const pool = new Pool({
  host: "localhost",
  port: 5432,
  database: "budget_manager",
  user: "budget_user",
  password: "budget_password",
});

async function updateParentColors() {
  const client = await pool.connect();

  try {
    console.log("🎨 Updating parent tag colors with logical grouping...\n");

    // Color scheme definition
    const colorScheme = {
      // Financial/Income related (Blue)
      financial: {
        color: "#3b82f6",
        tags: ["B2B", "Credits", "Investments", "Savings"],
      },
      // Bills/Expenses (Red)
      expenses: {
        color: "#ef4444",
        tags: ["Bills", "Fees", "Home", "Utilities"],
      },
      // Transportation (Orange)
      transportation: {
        color: "#f97316",
        tags: ["Car", "Public Transport"],
      },
      // Lifestyle/Personal (Purple)
      lifestyle: {
        color: "#8b5cf6",
        tags: ["Health", "Personal", "Sports", "Pets"],
      },
      // Entertainment/Leisure (Pink)
      entertainment: {
        color: "#ec4899",
        tags: ["Entertainment", "Travel", "Wedding"],
      },
      // Education/Subscriptions (Yellow)
      education: {
        color: "#eab308",
        tags: ["Education", "Subscriptions"],
      },
      // Shopping/Consumption (Green)
      shopping: {
        color: "#22c55e",
        tags: ["Food", "Shopping", "Advertising"],
      },
      // Goals/Gifts (Teal)
      goals: {
        color: "#14b8a6",
        tags: ["Goals", "Gifts"],
      },
      // Default/Misc (Gray)
      default: {
        color: "#6b7280",
        tags: ["DEFAULT"],
      },
    };

    let totalUpdates = 0;

    // Update each category
    for (const [category, config] of Object.entries(colorScheme)) {
      console.log(`📊 ${category.charAt(0).toUpperCase() + category.slice(1)} (${config.color}):`);

      for (const tagName of config.tags) {
        const result = await client.query(
          "UPDATE tags SET color = $1, updated_at = now() WHERE name = $2 AND parent_id IS NULL RETURNING name, color",
          [config.color, tagName]
        );

        if (result.rows.length > 0) {
          console.log(`  ✅ "${tagName}" → ${config.color}`);
          totalUpdates++;
        } else {
          console.log(`  ⚠️  "${tagName}" not found`);
        }
      }
      console.log("");
    }

    console.log(`🎉 Successfully updated ${totalUpdates} parent tags!`);

    // Show the updated parent tags
    console.log("\n📋 Updated Parent Tags:");
    console.log("=" * 50);

    const result = await client.query(`
      SELECT 
        name,
        color,
        CASE 
          WHEN parent_id IS NULL THEN 'Parent'
          ELSE 'Child'
        END as type
      FROM tags 
      WHERE parent_id IS NULL 
      ORDER BY name
    `);

    for (const row of result.rows) {
      console.log(`${row.name.padEnd(20)} ${row.color}`);
    }

    // Show color grouping summary
    console.log("\n🎨 Color Grouping Summary:");
    console.log("=" * 50);

    for (const [category, config] of Object.entries(colorScheme)) {
      const tagList = config.tags.join(", ");
      console.log(`${config.color} ${category.charAt(0).toUpperCase() + category.slice(1)}: ${tagList}`);
    }
  } catch (error) {
    console.error("❌ Error updating parent colors:", error);
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  try {
    await updateParentColors();
  } catch (error) {
    console.error("Script failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
