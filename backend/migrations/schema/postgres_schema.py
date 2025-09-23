"""
PostgreSQL Schema Definition
===========================

Complete PostgreSQL schema with all tables, indexes, constraints,
and PostgreSQL-specific features.
"""

POSTGRES_SCHEMA = """
-- Enable required PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create users table with PostgreSQL optimizations
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP,
    
    -- PostgreSQL specific constraints
    CONSTRAINT chk_users_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT chk_users_name_length CHECK (name IS NULL OR length(name) BETWEEN 1 AND 255)
);

-- Create challenges table with enhanced PostgreSQL features
CREATE TABLE IF NOT EXISTS challenges (
    challenge_id VARCHAR(255) PRIMARY KEY,
    creator_id VARCHAR(255) NOT NULL,
    title VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    lie_statement_id VARCHAR(255) NOT NULL,
    view_count INTEGER DEFAULT 0,
    guess_count INTEGER DEFAULT 0,
    correct_guess_count INTEGER DEFAULT 0,
    is_merged_video BOOLEAN DEFAULT FALSE,
    statements_json TEXT NOT NULL,
    merged_video_metadata_json TEXT,
    tags_json TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    published_at TIMESTAMP,
    
    -- PostgreSQL specific constraints
    CONSTRAINT chk_challenges_status CHECK (status IN ('draft', 'published', 'archived', 'deleted')),
    CONSTRAINT chk_challenges_view_count CHECK (view_count >= 0),
    CONSTRAINT chk_challenges_guess_count CHECK (guess_count >= 0),
    CONSTRAINT chk_challenges_correct_guess_count CHECK (correct_guess_count >= 0 AND correct_guess_count <= guess_count)
);

-- Create guesses table with foreign key relationships
CREATE TABLE IF NOT EXISTS guesses (
    guess_id VARCHAR(255) PRIMARY KEY,
    challenge_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    guessed_lie_statement_id VARCHAR(255) NOT NULL,
    is_correct BOOLEAN NOT NULL,
    response_time_seconds REAL,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key constraints
    CONSTRAINT fk_guesses_challenge_id 
        FOREIGN KEY (challenge_id) REFERENCES challenges(challenge_id) ON DELETE CASCADE,
        
    -- PostgreSQL specific constraints
    CONSTRAINT chk_guesses_response_time CHECK (response_time_seconds IS NULL OR response_time_seconds >= 0)
);

-- Create user_reports table with comprehensive constraints
CREATE TABLE IF NOT EXISTS user_reports (
    id SERIAL PRIMARY KEY,
    challenge_id VARCHAR(255) NOT NULL,
    user_id INTEGER NOT NULL,
    reason VARCHAR(100) NOT NULL,
    details TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key constraints
    CONSTRAINT fk_user_reports_user_id 
        FOREIGN KEY (user_id) REFERENCES users (id) 
        ON DELETE CASCADE,
        
    -- Enhanced constraints
    CONSTRAINT chk_user_reports_reason 
        CHECK (reason IN (
            'inappropriate_language', 'spam', 'personal_info', 
            'violence', 'hate_speech', 'adult_content', 
            'copyright', 'misleading', 'low_quality'
        )),
    CONSTRAINT chk_user_reports_details_length 
        CHECK (details IS NULL OR length(details) <= 1000)
);

-- Create token_balances table with PostgreSQL features
CREATE TABLE IF NOT EXISTS token_balances (
    user_id VARCHAR(255) PRIMARY KEY,
    balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Additional constraints
    CONSTRAINT chk_token_balances_balance_limit CHECK (balance <= 1000000)
);

-- Create token_transactions table with PostgreSQL UUID and JSONB
CREATE TABLE IF NOT EXISTS token_transactions (
    transaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    transaction_type VARCHAR(20) NOT NULL CHECK (
        transaction_type IN ('purchase', 'spend', 'adjustment', 'refund')
    ),
    amount INTEGER NOT NULL,
    balance_before INTEGER NOT NULL CHECK (balance_before >= 0),
    balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
    description TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    revenuecat_transaction_id VARCHAR(255),
    revenuecat_product_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Enhanced constraints
    CONSTRAINT chk_token_transactions_amount CHECK (amount != 0),
    CONSTRAINT chk_token_transactions_description_length CHECK (length(description) BETWEEN 1 AND 500)
);

-- Create user_sessions table with PostgreSQL UUID, JSONB, and INET
CREATE TABLE IF NOT EXISTS user_sessions (
    session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    jwt_token TEXT NOT NULL,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    session_type VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (
        session_type IN ('user', 'guest', 'admin')
    ),
    permissions JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    user_agent TEXT,
    ip_address INET,
    
    -- Enhanced constraints
    CONSTRAINT chk_user_sessions_expires_after_creation CHECK (expires_at > created_at),
    CONSTRAINT chk_user_sessions_last_accessed_reasonable CHECK (last_accessed >= created_at)
);

-- Create comprehensive indexes for performance
-- Users table indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login);
CREATE INDEX IF NOT EXISTS idx_users_name_gin ON users USING gin(name gin_trgm_ops) WHERE name IS NOT NULL;

-- Challenges table indexes
CREATE INDEX IF NOT EXISTS idx_challenges_creator_id ON challenges(creator_id);
CREATE INDEX IF NOT EXISTS idx_challenges_status ON challenges(status);
CREATE INDEX IF NOT EXISTS idx_challenges_created_at ON challenges(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_challenges_published_at ON challenges(published_at DESC) WHERE published_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_challenges_view_count ON challenges(view_count DESC);
CREATE INDEX IF NOT EXISTS idx_challenges_guess_count ON challenges(guess_count DESC);
CREATE INDEX IF NOT EXISTS idx_challenges_title_gin ON challenges USING gin(title gin_trgm_ops) WHERE title IS NOT NULL;

-- Guesses table indexes
CREATE INDEX IF NOT EXISTS idx_guesses_challenge_id ON guesses(challenge_id);
CREATE INDEX IF NOT EXISTS idx_guesses_user_id ON guesses(user_id);
CREATE INDEX IF NOT EXISTS idx_guesses_submitted_at ON guesses(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_guesses_is_correct ON guesses(is_correct);
CREATE INDEX IF NOT EXISTS idx_guesses_challenge_user ON guesses(challenge_id, user_id);

-- User_reports table indexes
CREATE INDEX IF NOT EXISTS idx_user_reports_challenge_id ON user_reports(challenge_id);
CREATE INDEX IF NOT EXISTS idx_user_reports_user_id ON user_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_user_reports_created_at ON user_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_reports_reason ON user_reports(reason);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_reports_unique_user_challenge ON user_reports(challenge_id, user_id);

-- Token tables indexes
CREATE INDEX IF NOT EXISTS idx_token_balances_last_updated ON token_balances(last_updated);
CREATE INDEX IF NOT EXISTS idx_token_transactions_user_id ON token_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_token_transactions_created_at ON token_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_token_transactions_type ON token_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_token_transactions_revenuecat ON token_transactions(revenuecat_transaction_id) WHERE revenuecat_transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_token_transactions_metadata_gin ON token_transactions USING gin(metadata);

-- Session tables indexes
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token_hash ON user_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_is_active ON user_sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_user_sessions_session_type ON user_sessions(session_type);
CREATE INDEX IF NOT EXISTS idx_user_sessions_ip_address ON user_sessions(ip_address) WHERE ip_address IS NOT NULL;

-- Create triggers for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_challenges_updated_at BEFORE UPDATE ON challenges
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function for session cleanup
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    cleaned_count INTEGER;
BEGIN
    UPDATE user_sessions 
    SET is_active = FALSE 
    WHERE expires_at < CURRENT_TIMESTAMP AND is_active = TRUE;
    
    GET DIAGNOSTICS cleaned_count = ROW_COUNT;
    RETURN cleaned_count;
END;
$$ LANGUAGE plpgsql;

-- Create partial indexes for common queries
CREATE INDEX IF NOT EXISTS idx_challenges_active_published 
    ON challenges(published_at DESC, view_count DESC) 
    WHERE status = 'published' AND published_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_sessions_active_recent 
    ON user_sessions(last_accessed DESC) 
    WHERE is_active = TRUE AND expires_at > CURRENT_TIMESTAMP;

-- Create statistics for query optimization
CREATE STATISTICS IF NOT EXISTS stat_challenges_creator_status 
    ON creator_id, status FROM challenges;

CREATE STATISTICS IF NOT EXISTS stat_guesses_challenge_correct 
    ON challenge_id, is_correct FROM guesses;
"""

ROLLBACK_SCHEMA = """
-- Rollback script to drop all PostgreSQL objects
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
DROP TRIGGER IF EXISTS update_challenges_updated_at ON challenges;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS cleanup_expired_sessions() CASCADE;

DROP STATISTICS IF EXISTS stat_challenges_creator_status;
DROP STATISTICS IF EXISTS stat_guesses_challenge_correct;

DROP TABLE IF EXISTS user_sessions CASCADE;
DROP TABLE IF EXISTS token_transactions CASCADE;
DROP TABLE IF EXISTS token_balances CASCADE;
DROP TABLE IF EXISTS user_reports CASCADE;
DROP TABLE IF EXISTS guesses CASCADE;
DROP TABLE IF EXISTS challenges CASCADE;
DROP TABLE IF EXISTS users CASCADE;

DROP EXTENSION IF EXISTS pg_trgm;
DROP EXTENSION IF EXISTS "uuid-ossp";
"""