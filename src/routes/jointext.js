/**
 * @file Route handler for /api/jointext endpoint - Join page content management
 * @module routes/jointext
 */

import express from 'express';
import bcrypt from 'bcrypt';
import { 
  getJoinText,
  saveJoinText,
  getAdminByUsername
} from '../database.js';
import { logError } from '../database.js';

const router = express.Router();

/**
 * Middleware to verify admin authentication
 */
async function verifyAdmin(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        message: 'Please provide admin credentials'
      });
    }

    // Decode Basic Auth
    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
    const [username, password] = credentials.split(':');

    if (!username || !password) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
        message: 'Username and password are required'
      });
    }

    // Verify admin credentials
    const admin = await getAdminByUsername(username);
    if (!admin) {
      await logError({
        type: 'security',
        endpoint: req.path,
        error: new Error('Invalid admin username'),
        context: { username, ip: req.ip }
      });
      
      return res.status(401).json({
        success: false,
        error: 'Authentication failed',
        message: 'Invalid username or password'
      });
    }

    const passwordMatch = await bcrypt.compare(password, admin.password);
    if (!passwordMatch) {
      await logError({
        type: 'security',
        endpoint: req.path,
        error: new Error('Invalid admin password'),
        context: { username, ip: req.ip }
      });
      
      return res.status(401).json({
        success: false,
        error: 'Authentication failed',
        message: 'Invalid username or password'
      });
    }

    // Attach admin info to request
    req.admin = { username };
    next();
  } catch (error) {
    await logError({
      type: 'api',
      endpoint: req.path,
      error: error,
      context: { method: req.method }
    });
    
    res.status(500).json({
      success: false,
      error: 'Authentication error',
      message: error.message
    });
  }
}

/**
 * GET /api/jointext - Get join text content (public)
 */
router.get('/', async (req, res) => {
  try {
    const joinText = await getJoinText();
    
    console.log('🔍 GET /api/jointext - Retrieved from DB:', joinText ? 'Found' : 'Not found');
    
    if (!joinText) {
      // Return default content if not found
      const defaultText = getDefaultJoinText();
      console.log('📦 Returning default join text with', defaultText.sections?.length || 0, 'sections');
      return res.json({
        success: true,
        joinText: defaultText
      });
    }

    const { _id, ...joinTextWithoutId } = joinText;
    console.log('📤 Returning join text from DB with', joinTextWithoutId.sections?.length || 0, 'sections');
    
    res.json({
      success: true,
      joinText: joinTextWithoutId
    });
  } catch (error) {
    console.error('❌ Error in GET /api/jointext:', error);
    await logError({
      type: 'api',
      endpoint: '/api/jointext',
      error: error,
      context: { method: 'GET' }
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to get join text',
      message: error.message
    });
  }
});

/**
 * PUT /api/jointext - Update join text content (admin only)
 */
router.put('/', verifyAdmin, async (req, res) => {
  try {
    const joinText = req.body;
    
    // Validate hero structure (optional)
    if (joinText.hero) {
      if (!joinText.hero.title || !joinText.hero.subtitle) {
        return res.status(400).json({
          success: false,
          error: 'Invalid hero data',
          message: 'hero must have title and subtitle'
        });
      }
      if (joinText.hero.badges && !Array.isArray(joinText.hero.badges)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid hero badges',
          message: 'hero.badges must be an array'
        });
      }
    }
    
    // Validate sections structure
    if (!joinText.sections || !Array.isArray(joinText.sections)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid join text data',
        message: 'sections is required and must be an array'
      });
    }

    // Validate each section
    for (let i = 0; i < joinText.sections.length; i++) {
      const section = joinText.sections[i];
      
      if (!section.id || section.order === undefined || !Array.isArray(section.blocks)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid section data',
          message: `Section at index ${i} is missing required fields (id, order, blocks)`
        });
      }

      // Validate each block in the section
      for (let j = 0; j < section.blocks.length; j++) {
        const block = section.blocks[j];
        
        if (!block.id || !block.type || !block.layout || block.order === undefined || !block.title) {
          return res.status(400).json({
            success: false,
            error: 'Invalid block data',
            message: `Block at section ${i}, index ${j} is missing required fields (id, type, layout, order, title)`
          });
        }

        // Validate block type
        if (!['text', 'list', 'contact'].includes(block.type)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid block type',
            message: `Block type must be text, list, or contact (section ${i}, block ${j})`
          });
        }

        // Validate layout
        if (!['full', 'left', 'right'].includes(block.layout)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid block layout',
            message: `Block layout must be full, left, or right (section ${i}, block ${j})`
          });
        }

        // Validate type-specific fields
        if (block.type === 'text' && !block.content) {
          return res.status(400).json({
            success: false,
            error: 'Invalid text block',
            message: `Text blocks must have content (section ${i}, block ${j})`
          });
        }

        if (block.type === 'list' && !Array.isArray(block.items)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid list block',
            message: `List blocks must have items array (section ${i}, block ${j})`
          });
        }

        if (block.type === 'contact' && !block.discord && !block.email) {
          return res.status(400).json({
            success: false,
            error: 'Invalid contact block',
            message: `Contact blocks must have at least discord or email (section ${i}, block ${j})`
          });
        }
      }
    }

    // Save join text
    await saveJoinText(joinText);
    
    // Log the update
    await logError({
      type: 'admin-action',
      endpoint: '/api/jointext',
      error: new Error('Join text updated'),
      context: { 
        username: req.admin.username,
        ip: req.ip,
        sectionCount: joinText.sections.length
      }
    });

    res.json({
      success: true,
      message: 'Join text updated successfully',
      joinText
    });
  } catch (error) {
    await logError({
      type: 'api',
      endpoint: '/api/jointext',
      error: error,
      context: { method: 'PUT', body: req.body }
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to update join text',
      message: error.message
    });
  }
});

/**
 * POST /api/jointext/seed - Seed database with default join text (admin only)
 */
router.post('/seed', verifyAdmin, async (req, res) => {
  try {
    const defaultJoinText = getDefaultJoinText();
    console.log('🌱 Seeding join text with', defaultJoinText.sections?.length || 0, 'sections');
    
    // Save default join text to database
    await saveJoinText(defaultJoinText);
    console.log('✅ Join text seeded successfully');
    
    // Log the seed action
    await logError({
      type: 'admin-action',
      endpoint: '/api/jointext/seed',
      error: new Error('Join text seeded'),
      context: { 
        username: req.admin.username,
        ip: req.ip,
        sectionCount: defaultJoinText.sections?.length || 0
      }
    });

    res.json({
      success: true,
      message: 'Join text seeded successfully with default data',
      joinText: defaultJoinText
    });
  } catch (error) {
    console.error('❌ Error seeding join text:', error);
    await logError({
      type: 'api',
      endpoint: '/api/jointext/seed',
      error: error,
      context: { method: 'POST' }
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to seed join text',
      message: error.message
    });
  }
});

/**
 * Get default join text content - Section-based structure
 * Exported for use in install route
 * 
 * Structure:
 * - sections: Array of section objects
 * - Each section contains blocks that can be positioned left/right/full
 * 
 * Block types:
 * - text: Simple text content with title
 * - list: List of items with title
 * - contact: Contact information with Discord/Email links
 * 
 * Layout options:
 * - full: Takes entire width of section
 * - left: Takes left half of section
 * - right: Takes right half of section
 */
export function getDefaultJoinText() {
  return {
    hero: {
      title: "Join Our Guild",
      subtitle: "Embark on epic adventures with skilled players. We're recruiting dedicated raiders and social members.",
      badges: [
        { label: "Active Community", color: "gold" },
        { label: "Mythic Progression", color: "blue" },
        { label: "All Roles Welcome", color: "green" }
      ]
    },
    sections: [
      // Section 1: Welcome (Full Width)
      {
        id: "section-1",
        order: 0,
        blocks: [
          {
            id: "block-1",
            order: 0,
            type: "text",
            layout: "full",
            title: "Welcome to Our Guild",
            content: "GUILD NAME is a semi-hardcore guild located on the retail EU-Ravencrest Realm. We're looking for players who can strengthen our roster and help us progress Mythic as far as possible.\n\nThe guild is welcoming and open to everyone. Our players are from across the globe, but unite under our banner to enjoy all aspects of the game."
          }
        ]
      },
      
      // Section 2: Requirements & Benefits (Split)
      {
        id: "section-2",
        order: 1,
        blocks: [
          {
            id: "block-2",
            order: 0,
            type: "list",
            layout: "left",
            title: "Mythic Raiding Requirements",
            items: [
              "Item Level: 628+ for Season 3 progression",
              "Raid Experience: 8/8 Heroic experience or greater",
              "Performance: Good logs showing both Output and Mechanical performance",
              "Preparation: Being prepared in analyzing your own logs, class and spec, as well as reading into raid mechanics",
              "Communication: Good Communication Skills and Teamwork",
              "Attitude: Can take Constructive Criticism in stride"
            ]
          },
          {
            id: "block-3",
            order: 1,
            type: "list",
            layout: "right",
            title: "Guild Benefits",
            items: [
              "Organized Raid Schedule: Consistent raid times with clear communication",
              "Progression Focus: Dedicated to pushing Mythic content as far as possible",
              "Community: Active Discord server with friendly, helpful members",
              "Guild Bank: Access to consumables and materials for progression",
              "Mythic+ Groups: Regular dungeon runs for gear and practice",
              "PvP Activities: Rated battlegrounds and arena teams"
            ]
          }
        ]
      },
      
      // Section 3: Application & Current Needs (Split)
      {
        id: "section-3",
        order: 2,
        blocks: [
          {
            id: "block-4",
            order: 0,
            type: "list",
            layout: "left",
            title: "Application Process",
            items: [
              "Submit Application: Fill out our recruitment form with your details",
              "Character Review: Officers will review your logs, gear, and experience",
              "Trial Period: Join us for a few raids to see if we're a good fit",
              "Guild Membership: Full access to guild benefits and progression"
            ]
          },
          {
            id: "block-5",
            order: 1,
            type: "list",
            layout: "right",
            title: "Current Needs",
            items: [
              "Healers: All healing specializations welcome",
              "Tanks: Experienced tank players for progression",
              "DPS: High-performing damage dealers",
              "Social Members: Casual players welcome to join our community"
            ]
          }
        ]
      },
      
      // Section 4: Raid Schedule (Full Width)
      {
        id: "section-4",
        order: 3,
        blocks: [
          {
            id: "block-6",
            order: 0,
            type: "list",
            layout: "full",
            title: "Raid Schedule",
            items: [
              "Tuesday: 20:00 - 23:00 CET - Mythic Progression",
              "Thursday: 20:00 - 23:00 CET - Mythic Progression",
              "Sunday: 19:00 - 22:00 CET - Heroic Farm / Alt Runs"
            ]
          }
        ]
      },
      
      // Section 5: Contact (Full Width)
      {
        id: "section-5",
        order: 4,
        blocks: [
          {
            id: "block-7",
            order: 0,
            type: "contact",
            layout: "full",
            title: "Ready to Join Us?",
            discord: {
              label: "Join our Discord",
              url: "https://discord.gg/yourguild"
            },
            email: {
              label: "Contact Officers",
              url: "mailto:officers@yourguild.com"
            }
          }
        ]
      }
    ]
  };
}

export default router;

