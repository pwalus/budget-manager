const { Pool } = require("pg");

// Database configuration
const pool = new Pool({
  host: "localhost",
  port: 5432,
  database: "budget_manager",
  user: "budget_user",
  password: "budget_password",
});

async function syncTagColors() {
  const client = await pool.connect();

  try {
    console.log("Starting tag color synchronization...");

    // Get all tags with their parent information
    const result = await client.query(`
      SELECT 
        t.id,
        t.name,
        t.parent_id,
        t.color,
        p.color as parent_color
      FROM tags t
      LEFT JOIN tags p ON t.parent_id = p.id
      WHERE t.parent_id IS NOT NULL
      ORDER BY t.parent_id, t.name
    `);

    const tagsToUpdate = result.rows.filter((tag) => tag.parent_color && tag.color !== tag.parent_color);

    if (tagsToUpdate.length === 0) {
      console.log("✅ All child tags already have the same color as their parents!");
      return;
    }

    console.log(`Found ${tagsToUpdate.length} child tags that need color updates:`);

    // Update each child tag to match parent color
    for (const tag of tagsToUpdate) {
      console.log(`  - "${tag.name}" (${tag.color} → ${tag.parent_color})`);

      await client.query("UPDATE tags SET color = $1, updated_at = now() WHERE id = $2", [tag.parent_color, tag.id]);
    }

    console.log(`\n✅ Successfully updated ${tagsToUpdate.length} child tags to match their parent colors!`);

    // Show summary of remaining tags
    const summaryResult = await client.query(`
      SELECT 
        p.name as parent_name,
        p.color as parent_color,
        COUNT(c.id) as child_count
      FROM tags p
      LEFT JOIN tags c ON p.id = c.parent_id
      WHERE p.parent_id IS NULL
      GROUP BY p.id, p.name, p.color
      ORDER BY p.name
    `);

    console.log("\n📊 Tag hierarchy summary:");
    for (const row of summaryResult.rows) {
      if (row.child_count > 0) {
        console.log(`  - "${row.parent_name}" (${row.parent_color}): ${row.child_count} children`);
      }
    }
  } catch (error) {
    console.error("❌ Error synchronizing tag colors:", error);
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  try {
    await syncTagColors();
  } catch (error) {
    console.error("Script failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
