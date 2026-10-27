-- ============================================================================
-- ReelMitra — Sample Seed Data for Testing & Learning
-- ============================================================================

-- 1. Insert Categories (Hierarchical: Parent -> Subcategories)
INSERT INTO categories (id, name, slug, description, sort_order) VALUES
('11111111-1111-1111-1111-111111111111', 'Video Editing', 'video-editing', 'All kinds of video editing services', 1)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO categories (id, parent_id, name, slug, description, sort_order) VALUES
('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Instagram Reels & Shorts', 'instagram-reels-shorts', 'Fast-paced, hook-driven short form vertical videos', 1),
('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'YouTube Long-form', 'youtube-long-form', 'Documentary, talking head, and vlogs', 2),
('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 'Wedding & Event Films', 'wedding-event-films', 'Cinematic wedding teasers and highlight films', 3)
ON CONFLICT (slug) DO NOTHING;

-- 2. Insert Users (1 Client, 1 Editor, 1 Admin)
-- Password hash: placeholder for demonstration
INSERT INTO users (id, first_name, last_name, email, phone, password_hash, role) VALUES
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Aarav', 'Sharma', 'aarav.client@reelmitra.com', '+919876543210', '$2b$12$eXampLeHashForDemoPassword123', 'client'),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Rohan', 'Verma', 'rohan.editor@reelmitra.com', '+919876543211', '$2b$12$eXampLeHashForDemoPassword456', 'editor'),
('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Admin', 'User', 'admin@reelmitra.com', '+919876543212', '$2b$12$eXampLeHashForDemoPassword789', 'admin')
ON CONFLICT (email) DO NOTHING;

-- 3. Insert Editor Profile
INSERT INTO editor_profiles (id, user_id, display_name, bio, experience_years, pricing_from, availability_status, average_rating, total_reviews) VALUES
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Rohan Cuts', 'Specialist in viral retention edits, Alex Hormozi style reels and storytelling.', 4, 1500.00, 'available', 4.90, 15)
ON CONFLICT (user_id) DO NOTHING;

-- 4. Associate Editor with Categories
INSERT INTO editor_categories (editor_id, category_id, experience_years) VALUES
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '22222222-2222-2222-2222-222222222222', 4),
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '33333333-3333-3333-3333-333333333333', 2)
ON CONFLICT DO NOTHING;

-- 5. Insert Portfolio Items
INSERT INTO portfolio_items (editor_id, title, description, media_url, thumbnail_url, sort_order) VALUES
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '1 Million Views Reel Edit', 'High retention edit for a fitness influencer with dynamic captions and sound design.', 'https://storage.reelmitra.com/portfolio/sample1.mp4', 'https://storage.reelmitra.com/portfolio/thumb1.jpg', 1),
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Podcast Cutdown', '30-second punchy soundbite with zooms and b-roll inserts.', 'https://storage.reelmitra.com/portfolio/sample2.mp4', 'https://storage.reelmitra.com/portfolio/thumb2.jpg', 2);

-- 6. Insert Sample Order
INSERT INTO orders (
    id, client_id, editor_id, category_id, title, brief, requested_deadline, budget, status, revision_limit
) VALUES (
    '99999999-9999-9999-9999-999999999999',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    '22222222-2222-2222-2222-222222222222',
    'Edit 3 Instagram Reels for Tech Channel',
    'Raw footage is in drive. Need dynamic captions, sound effects, and 60-second runtime each.',
    CURRENT_TIMESTAMP + INTERVAL '3 days',
    4500.00,
    'pending_editor_review',
    2
) ON CONFLICT DO NOTHING;

-- 7. Insert Order Status History
INSERT INTO order_status_history (order_id, changed_by, old_status, new_status, note) VALUES
('99999999-9999-9999-9999-999999999999', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', NULL, 'pending_editor_review', 'Order created by client and submitted to editor.')
ON CONFLICT DO NOTHING;

-- 8. Insert Sample Review
INSERT INTO reviews (id, order_id, reviewer_id, editor_id, rating, comment) VALUES
('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 5.0, 'Incredible reel edits! The pacing, sound effects, and color grading were top notch.')
ON CONFLICT DO NOTHING;
