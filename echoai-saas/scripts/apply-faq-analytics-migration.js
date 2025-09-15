const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function applyFAQAnalyticsMigration() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase environment variables');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    console.log('Applying FAQ Analytics migration...');

    // Read the migration SQL
    const migrationPath = path.join(__dirname, '..', 'prisma', 'migrations', '009_add_faq_analytics.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Split the SQL into individual statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);

    // Execute each statement
    for (const statement of statements) {
      console.log(`Executing: ${statement.substring(0, 50)}...`);
      const { error } = await supabase.rpc('exec_sql', { sql: statement });
      
      if (error) {
        console.error('Error executing statement:', error);
        throw error;
      }
    }

    console.log('FAQ Analytics migration applied successfully!');

    // Verify the changes
    const { data: faqColumns, error: faqError } = await supabase
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_name', 'FAQ')
      .in('column_name', ['popularity', 'tags', 'lastUpdated']);

    if (faqError) {
      console.error('Error verifying FAQ table:', faqError);
    } else {
      console.log('FAQ table columns added:', faqColumns.map(c => c.column_name));
    }

    const { data: analyticsTable, error: analyticsError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_name', 'FAQAnalytics');

    if (analyticsError) {
      console.error('Error verifying FAQAnalytics table:', analyticsError);
    } else if (analyticsTable.length > 0) {
      console.log('FAQAnalytics table created successfully');
    }

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  applyFAQAnalyticsMigration();
}

module.exports = { applyFAQAnalyticsMigration };