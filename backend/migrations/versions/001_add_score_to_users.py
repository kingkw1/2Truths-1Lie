"""
Adds score to users table
"""

def upgrade(db_conn):
    """
    Adds the score column to the users table.
    """
    db_conn.execute("""
        ALTER TABLE users
        ADD COLUMN score INTEGER NOT NULL DEFAULT 0;
    """)

def downgrade(db_conn):
    """
    Removes the score column from the users table.
    """
    db_conn.execute("""
        ALTER TABLE users
        DROP COLUMN score;
    """)