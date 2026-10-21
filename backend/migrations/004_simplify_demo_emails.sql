-- Simplify demo account emails for easier presentation login.
-- Run once after the connection workflow migration. Back up the database first.
-- These are fictional demo emails; no messages should be sent to them.

UPDATE users SET email = 'meera@gmail.com' WHERE email = 'meera.tailor@gmail.com';
UPDATE users SET email = 'anjali@gmail.com' WHERE email = 'anjali.stitch@gmail.com';
UPDATE users SET email = 'fathima@gmail.com' WHERE email = 'fathima.embroidery@gmail.com';
UPDATE users SET email = 'sunitha@gmail.com' WHERE email = 'sunitha.baker@gmail.com';
UPDATE users SET email = 'priya@gmail.com' WHERE email = 'priya.chef@gmail.com';
UPDATE users SET email = 'divya@gmail.com' WHERE email = 'divya.tutor@gmail.com';
UPDATE users SET email = 'lakshmi@gmail.com' WHERE email = 'lakshmi.crafts@gmail.com';
UPDATE users SET email = 'geetha@gmail.com' WHERE email = 'geetha.beauty@gmail.com';
UPDATE users SET email = 'reshma@gmail.com' WHERE email = 'reshma.newtailor@gmail.com';
UPDATE users SET email = 'kavya@gmail.com' WHERE email = 'kavya.designer@gmail.com';
UPDATE users SET email = 'nithya@gmail.com' WHERE email = 'nithya.catering@gmail.com';
UPDATE users SET email = 'asha@gmail.com' WHERE email = 'asha.crafttutor@gmail.com';

UPDATE users SET email = 'rosepetal@gmail.com' WHERE email = 'boutique.owner@gmail.com';
UPDATE users SET email = 'sweetnest@gmail.com' WHERE email = 'cakehouse.owner@gmail.com';
UPDATE users SET email = 'ammaskitchen@gmail.com' WHERE email = 'cateringco.owner@gmail.com';
UPDATE users SET email = 'learningcorner@gmail.com' WHERE email = 'learningcorner.owner@gmail.com';
UPDATE users SET email = 'craftstudio@gmail.com' WHERE email = 'craftstudio.owner@gmail.com';
UPDATE users SET email = 'blushbridal@gmail.com' WHERE email = 'weddingplanner.owner@gmail.com';
