const { query } = require('../backend/config/database');
const fs = require('fs');
const path = require('path');

// SQLファイルを適切に分割する関数
function splitSQL(sql) {
  const statements = [];
  let current = '';
  let inDollarQuote = false;
  let dollarTag = '';
  let inComment = false;
  let i = 0;

  while (i < sql.length) {
    const char = sql[i];
    const next = sql[i + 1];

    // コメント処理
    if (!inDollarQuote && char === '-' && next === '-') {
      inComment = true;
      current += char;
      i++;
      continue;
    }

    if (inComment && char === '\n') {
      inComment = false;
      current += char;
      i++;
      continue;
    }

    if (inComment) {
      current += char;
      i++;
      continue;
    }

    // ドル記号文字列処理
    if (char === '$' && !inDollarQuote) {
      let tag = '$';
      let j = i + 1;
      while (j < sql.length && sql[j] !== '$') {
        tag += sql[j];
        j++;
      }
      if (j < sql.length) {
        tag += '$';
        inDollarQuote = true;
        dollarTag = tag;
        current += tag;
        i = j;
      } else {
        current += char;
      }
    } else if (inDollarQuote && sql.substring(i, i + dollarTag.length) === dollarTag) {
      inDollarQuote = false;
      current += dollarTag;
      i += dollarTag.length - 1;
      dollarTag = '';
    } else if (!inDollarQuote && char === ';') {
      current += char;
      if (current.trim()) {
        statements.push(current.trim());
      }
      current = '';
    } else {
      current += char;
    }
    
    i++;
  }

  // 最後の文も追加
  if (current.trim()) {
    statements.push(current.trim());
  }

  return statements;
}

async function initPostgreSQLDatabase() {
  console.log('🚀 Initializing PostgreSQL database...');
  
  try {
    // データベース接続テスト
    console.log('📡 Testing database connection...');
    const testResult = await query('SELECT 1 as test');
    console.log('✅ Database connection successful');

    // スキーマファイルを読み込み
    const schemaPath = path.join(process.cwd(), 'migrations', 'postgresql-schema.sql');
    console.log(`📁 Loading schema from: ${schemaPath}`);
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
    
    // SQLを適切に分割（ドル記号文字列とコメントを考慮）
    const statements = splitSQL(schemaSQL);
    
    console.log(`📋 Executing ${statements.length} SQL statements...`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        try {
          await query(statement);
          console.log(`✅ Statement ${i + 1}/${statements.length} executed successfully`);
        } catch (error) {
          // CREATE TABLE IF NOT EXISTS や CREATE INDEX IF NOT EXISTS の重複エラーは無視
          if (error.message.includes('already exists')) {
            console.log(`⚠️  Statement ${i + 1}/${statements.length} - Object already exists (ignored)`);
          } else {
            console.error(`❌ Statement ${i + 1}/${statements.length} failed:`, error.message);
            throw error;
          }
        }
      }
    }

    console.log('🎉 PostgreSQL database initialized successfully');
    return true;

  } catch (error) {
    console.error('❌ Failed to initialize PostgreSQL database:', error);
    throw error;
  }
}

async function createDefaultAdmin() {
  try {
    console.log('👤 Checking for admin user...');
    
    // 管理者ユーザーが既に存在するかチェック
    const adminCheck = await query('SELECT id FROM users WHERE is_admin = TRUE LIMIT 1');
    
    if (adminCheck.length > 0) {
      console.log('✅ Admin user already exists');
      return;
    }

    // 最初に登録されたユーザーを管理者にする
    const firstUser = await query('SELECT id FROM users ORDER BY id LIMIT 1');
    
    if (firstUser.length > 0) {
      await query('UPDATE users SET is_admin = TRUE WHERE id = $1', [firstUser[0].id]);
      console.log('✅ First user promoted to admin');
      
      // デフォルトデータを挿入
      await query('SELECT insert_default_data()');
      console.log('✅ Default data inserted');
    } else {
      console.log('ℹ️  No users found - admin will be created with first registration');
    }

  } catch (error) {
    console.error('❌ Failed to create default admin:', error);
    throw error;
  }
}

// 直接実行された場合
if (require.main === module) {
  initPostgreSQLDatabase()
    .then(() => createDefaultAdmin())
    .then(() => {
      console.log('🎊 Database setup completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Database setup failed:', error);
      process.exit(1);
    });
}

module.exports = {
  initPostgreSQLDatabase,
  createDefaultAdmin
};
