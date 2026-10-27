-- ============================================================================
-- ReelMitra — MVP Database Schema (PostgreSQL)
-- ============================================================================

-- 0. Enable Extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Reusable trigger function to auto-update 'updated_at' columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- 1. USERS & ACCOUNTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(30),
    password_hash TEXT NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'client',
    avatar_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    email_verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_users_email UNIQUE (email),
    CONSTRAINT chk_users_role CHECK (role IN ('client', 'editor', 'admin'))
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- 2. EDITOR PROFILES
-- ============================================================================

CREATE TABLE IF NOT EXISTS editor_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    display_name VARCHAR(150) NOT NULL,
    bio TEXT,
    experience_years INTEGER DEFAULT 0,
    pricing_from NUMERIC(12, 2) DEFAULT 0.00,
    availability_status VARCHAR(30) NOT NULL DEFAULT 'available',
    average_rating NUMERIC(3, 2) DEFAULT 0.00,
    total_reviews INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_editor_profiles_user_id UNIQUE (user_id),
    CONSTRAINT fk_editor_profiles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT chk_editor_availability CHECK (availability_status IN ('available', 'busy', 'unavailable')),
    CONSTRAINT chk_editor_experience_years CHECK (experience_years >= 0),
    CONSTRAINT chk_editor_pricing_from CHECK (pricing_from >= 0),
    CONSTRAINT chk_editor_average_rating CHECK (average_rating >= 0 AND average_rating <= 5.00),
    CONSTRAINT chk_editor_total_reviews CHECK (total_reviews >= 0)
);

CREATE INDEX IF NOT EXISTS idx_editor_profiles_user_id ON editor_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_editor_profiles_availability ON editor_profiles(availability_status);

DROP TRIGGER IF EXISTS trg_editor_profiles_updated_at ON editor_profiles;
CREATE TRIGGER trg_editor_profiles_updated_at
BEFORE UPDATE ON editor_profiles
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- 3. CATEGORIES & SPECIALIZATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(120) NOT NULL,
    description TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_categories_slug UNIQUE (slug),
    CONSTRAINT fk_categories_parent FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);

DROP TRIGGER IF EXISTS trg_categories_updated_at ON categories;
CREATE TRIGGER trg_categories_updated_at
BEFORE UPDATE ON categories
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();


CREATE TABLE IF NOT EXISTS editor_categories (
    editor_id UUID NOT NULL,
    category_id UUID NOT NULL,
    experience_years INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (editor_id, category_id),
    CONSTRAINT fk_editor_categories_editor FOREIGN KEY (editor_id) REFERENCES editor_profiles(id) ON DELETE CASCADE,
    CONSTRAINT fk_editor_categories_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
    CONSTRAINT chk_editor_cat_experience_years CHECK (experience_years >= 0)
);

CREATE INDEX IF NOT EXISTS idx_editor_categories_category_id ON editor_categories(category_id);


-- ============================================================================
-- 4. PORTFOLIO ITEMS
-- ============================================================================

CREATE TABLE IF NOT EXISTS portfolio_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    editor_id UUID NOT NULL,
    category_id UUID,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    media_url TEXT NOT NULL,
    thumbnail_url TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_portfolio_items_editor FOREIGN KEY (editor_id) REFERENCES editor_profiles(id) ON DELETE CASCADE,
    CONSTRAINT fk_portfolio_items_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

ALTER TABLE portfolio_items ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id) ON DELETE SET NULL;
ALTER TABLE portfolio_items ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_portfolio_items_editor_id ON portfolio_items(editor_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_items_category_id ON portfolio_items(category_id);


-- ============================================================================
-- 5. ORDERS & LIFECYCLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL,
    editor_id UUID NOT NULL,
    category_id UUID NOT NULL,
    title VARCHAR(200) NOT NULL,
    brief TEXT NOT NULL,
    requested_deadline TIMESTAMPTZ NOT NULL,
    agreed_deadline TIMESTAMPTZ,
    budget NUMERIC(12, 2),
    quoted_price NUMERIC(12, 2),
    agreed_price NUMERIC(12, 2),
    currency CHAR(3) NOT NULL DEFAULT 'INR',
    status VARCHAR(30) NOT NULL DEFAULT 'draft',
    revision_limit INTEGER NOT NULL DEFAULT 0,
    revisions_used INTEGER NOT NULL DEFAULT 0,
    accepted_at TIMESTAMPTZ,
    payment_confirmed_at TIMESTAMPTZ,
    approved_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_orders_client FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_orders_editor FOREIGN KEY (editor_id) REFERENCES editor_profiles(id) ON DELETE RESTRICT,
    CONSTRAINT fk_orders_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT,
    CONSTRAINT chk_orders_budget CHECK (budget >= 0),
    CONSTRAINT chk_orders_quoted_price CHECK (quoted_price >= 0),
    CONSTRAINT chk_orders_agreed_price CHECK (agreed_price >= 0),
    CONSTRAINT chk_orders_revision_limit CHECK (revision_limit >= 0),
    CONSTRAINT chk_orders_revisions_used CHECK (revisions_used >= 0),
    CONSTRAINT chk_orders_status CHECK (
        status IN (
            'draft',
            'pending_editor_review',
            'accepted',
            'payment_pending',
            'in_progress',
            'preview_ready',
            'revision_requested',
            'approved',
            'completed',
            'rejected',
            'cancelled',
            'disputed'
        )
    )
);

CREATE INDEX IF NOT EXISTS idx_orders_client_id ON orders(client_id);
CREATE INDEX IF NOT EXISTS idx_orders_editor_id ON orders(editor_id);
CREATE INDEX IF NOT EXISTS idx_orders_category_id ON orders(category_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);

DROP TRIGGER IF EXISTS trg_orders_updated_at ON orders;
CREATE TRIGGER trg_orders_updated_at
BEFORE UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- 6. ORDER STATUS HISTORY
-- ============================================================================

CREATE TABLE IF NOT EXISTS order_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL,
    changed_by UUID NOT NULL,
    old_status VARCHAR(30),
    new_status VARCHAR(30) NOT NULL,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_order_status_history_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    CONSTRAINT fk_order_status_history_user FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id ON order_status_history(order_id);


-- ============================================================================
-- 7. MEDIA FILES & DELIVERABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS media_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    uploaded_by UUID NOT NULL,
    order_id UUID,
    file_name VARCHAR(255) NOT NULL,
    storage_key TEXT NOT NULL,
    media_type VARCHAR(30) NOT NULL,
    mime_type VARCHAR(150) NOT NULL,
    size_bytes BIGINT NOT NULL,
    upload_status VARCHAR(30) NOT NULL DEFAULT 'pending',
    visibility VARCHAR(20) NOT NULL DEFAULT 'private',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_media_files_user FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_media_files_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
    CONSTRAINT chk_media_size CHECK (size_bytes >= 0),
    CONSTRAINT chk_media_type CHECK (media_type IN ('video', 'image', 'document', 'audio', 'other')),
    CONSTRAINT chk_media_upload_status CHECK (upload_status IN ('pending', 'uploaded', 'failed')),
    CONSTRAINT chk_media_visibility CHECK (visibility IN ('private', 'shared', 'public'))
);

CREATE INDEX IF NOT EXISTS idx_media_files_uploaded_by ON media_files(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_media_files_order_id ON media_files(order_id);


CREATE TABLE IF NOT EXISTS order_deliverables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL,
    media_file_id UUID NOT NULL,
    deliverable_type VARCHAR(30) NOT NULL,
    version_number INTEGER NOT NULL DEFAULT 1,
    submitted_by UUID NOT NULL,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_order_deliverables_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    CONSTRAINT fk_order_deliverables_media FOREIGN KEY (media_file_id) REFERENCES media_files(id) ON DELETE RESTRICT,
    CONSTRAINT fk_order_deliverables_submitter FOREIGN KEY (submitted_by) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT chk_deliverable_type CHECK (deliverable_type IN ('preview', 'revision', 'final')),
    CONSTRAINT chk_deliverable_version CHECK (version_number > 0)
);

CREATE INDEX IF NOT EXISTS idx_order_deliverables_order_id ON order_deliverables(order_id);
CREATE INDEX IF NOT EXISTS idx_order_deliverables_media_id ON order_deliverables(media_file_id);


-- ============================================================================
-- 8. CONVERSATIONS & MESSAGES
-- ============================================================================

CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL,
    editor_id UUID NOT NULL,
    order_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_conversations_client FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_conversations_editor FOREIGN KEY (editor_id) REFERENCES editor_profiles(id) ON DELETE CASCADE,
    CONSTRAINT fk_conversations_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_conversations_client_id ON conversations(client_id);
CREATE INDEX IF NOT EXISTS idx_conversations_editor_id ON conversations(editor_id);
CREATE INDEX IF NOT EXISTS idx_conversations_order_id ON conversations(order_id);

DROP TRIGGER IF EXISTS trg_conversations_updated_at ON conversations;
CREATE TRIGGER trg_conversations_updated_at
BEFORE UPDATE ON conversations
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();


CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL,
    sender_id UUID NOT NULL,
    message_text TEXT NOT NULL,
    message_type VARCHAR(30) NOT NULL DEFAULT 'text',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    edited_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,

    CONSTRAINT fk_messages_conversation FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    CONSTRAINT fk_messages_sender FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT chk_messages_type CHECK (message_type IN ('text', 'file', 'system'))
);

-- Fast chronological chat message retrieval
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id_created_at ON messages(conversation_id, created_at ASC);


-- ============================================================================
-- 9. PAYMENTS (Phase 6 / Checkout)
-- ============================================================================

CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL,
    payer_id UUID NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'INR',
    platform_fee NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    editor_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    gateway_reference VARCHAR(255),
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_payments_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT,
    CONSTRAINT fk_payments_payer FOREIGN KEY (payer_id) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT chk_payments_amount CHECK (amount >= 0),
    CONSTRAINT chk_payments_platform_fee CHECK (platform_fee >= 0),
    CONSTRAINT chk_payments_editor_amount CHECK (editor_amount >= 0),
    CONSTRAINT chk_payments_status CHECK (status IN ('pending', 'succeeded', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_payer_id ON payments(payer_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);


-- ============================================================================
-- 10. REVIEWS & RATINGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID,
    reviewer_id UUID NOT NULL,
    editor_id UUID NOT NULL,
    rating NUMERIC(2, 1) NOT NULL,
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_reviews_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
    CONSTRAINT fk_reviews_reviewer FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_reviews_editor FOREIGN KEY (editor_id) REFERENCES editor_profiles(id) ON DELETE CASCADE,
    CONSTRAINT chk_reviews_rating CHECK (rating >= 1.0 AND rating <= 5.0)
);

CREATE INDEX IF NOT EXISTS idx_reviews_editor_id ON reviews(editor_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer_id ON reviews(reviewer_id);
