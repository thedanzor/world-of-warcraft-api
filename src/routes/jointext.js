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
    
    if (!joinText) {
      // Return default content if not found
      return res.json({
        success: true,
        joinText: getDefaultJoinText()
      });
    }

    const { _id, ...joinTextWithoutId } = joinText;
    
    res.json({
      success: true,
      joinText: joinTextWithoutId
    });
  } catch (error) {
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
    
    // Validate blocks structure
    if (!joinText.blocks || !Array.isArray(joinText.blocks)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid join text data',
        message: 'blocks is required and must be an array'
      });
    }

    // Validate each block has required fields
    for (let i = 0; i < joinText.blocks.length; i++) {
      const block = joinText.blocks[i];
      if (!block.id || !block.type || block.order === undefined || !block.data) {
        return res.status(400).json({
          success: false,
          error: 'Invalid block data',
          message: `Block at index ${i} is missing required fields (id, type, order, data)`
        });
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
        blockCount: joinText.blocks.length
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
    
    // Save default join text to database
    await saveJoinText(defaultJoinText);
    
    // Log the seed action
    await logError({
      type: 'admin-action',
      endpoint: '/api/jointext/seed',
      error: new Error('Join text seeded'),
      context: { 
        username: req.admin.username,
        ip: req.ip
      }
    });

    res.json({
      success: true,
      message: 'Join text seeded successfully with default data',
      joinText: defaultJoinText
    });
  } catch (error) {
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
 * Get default join text content - Block-based structure
 * Exported for use in install route
 * 
 * Block types:
 * - heading: Main page heading with floating text
 * - text: Single paragraph text
 * - text-highlight: Highlighted/bold text
 * - list: Single column list with title
 * - two-column-list: Two columns of lists side by side
 * - schedule: Raid schedule with day/time/activity
 * - contact: Contact section with Discord/Email links
 */
export function getDefaultJoinText() {
  return {
    blocks: [
      // Block 1: Main Heading
      {
        id: "block-heading",
        type: "heading",
        order: 0,
        data: {
          floatingText: "War Within Season 3",
          highlightText: "GUILD NAME",
          mainText: "is recruiting"
        }
      },
      
      // Block 2: Intro Paragraph 1
      {
        id: "block-intro-1",
        type: "text",
        order: 1,
        data: {
          content: "GUILD NAME is a semi-hardcore guild located on the retail EU-Ravencrest Realm. We're looking for players who can strengthen our roster and help us progress Mythic as far as possible."
        }
      },
      
      // Block 3: Intro Paragraph 2
      {
        id: "block-intro-2",
        type: "text",
        order: 2,
        data: {
          content: "The guild is welcoming and open to everyone. Our players are from across the globe, but unite under our banner to enjoy all aspects of the game."
        }
      },
      
      // Block 4: Intro Highlight
      {
        id: "block-intro-highlight",
        type: "text-highlight",
        order: 3,
        data: {
          content: "All social applicants and classes are welcome. For Mythic Raiding we have the following criteria and requirements - exceptions are possible for exceptional applicants."
        }
      },
      
      // Block 5: Requirements (Two Column)
      {
        id: "block-requirements",
        type: "two-column-list",
        order: 4,
        data: {
          sectionTitle: "What we're looking for",
          icon: "work",
          leftColumn: {
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
          rightColumn: {
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
        }
      },
      
      // Block 6: Application Process (Two Column)
      {
        id: "block-application",
        type: "two-column-list",
        order: 5,
        data: {
          sectionTitle: "Application Process & Current Needs",
          icon: "school",
          leftColumn: {
            title: "Application Process",
            items: [
              "Submit Application: Fill out our recruitment form with your details",
              "Character Review: Officers will review your logs, gear, and experience",
              "Trial Period: Join us for a few raids to see if we're a good fit",
              "Guild Membership: Full access to guild benefits and progression"
            ]
          },
          rightColumn: {
            title: "Current Needs",
            items: [
              "Healers: All healing specializations welcome",
              "Tanks: Experienced tank players for progression",
              "DPS: High-performing damage dealers",
              "Social Members: Casual players welcome to join our community"
            ]
          }
        }
      },
      
      // Block 7: Raid Schedule
      {
        id: "block-schedule",
        type: "schedule",
        order: 6,
        data: {
          sectionTitle: "Raid Schedule",
          icon: "schedule",
          items: [
            { day: "Tuesday", time: "20:00 - 23:00 CET", activity: "Mythic Progression" },
            { day: "Thursday", time: "20:00 - 23:00 CET", activity: "Mythic Progression" },
            { day: "Sunday", time: "19:00 - 22:00 CET", activity: "Heroic Farm / Alt Runs" }
          ]
        }
      },
      
      // Block 8: Guild Culture (Two Column)
      {
        id: "block-culture",
        type: "two-column-list",
        order: 7,
        data: {
          sectionTitle: "Guild Culture & Expectations",
          icon: "group",
          leftColumn: {
            title: "What We Expect",
            items: [
              "Attendance: 80% raid attendance for core raiders",
              "Preparation: Come prepared with consumables and knowledge",
              "Communication: Active participation in Discord during raids",
              "Improvement: Willingness to learn and improve",
              "Respect: Treat all members with respect and dignity"
            ]
          },
          rightColumn: {
            title: "What You Can Expect",
            items: [
              "Support: Help with gearing, enchants, and consumables",
              "Guidance: Experienced players to help you improve",
              "Community: Friendly atmosphere both in-game and Discord",
              "Progression: Clear goals and progression path",
              "Fun: We take raiding seriously but have fun doing it"
            ]
          }
        }
      },
      
      // Block 9: Achievements (Two Column)
      {
        id: "block-achievements",
        type: "two-column-list",
        order: 8,
        data: {
          sectionTitle: "Guild Achievements & Goals",
          icon: "star",
          leftColumn: {
            title: "Current Season Goals",
            items: [
              "Mythic Progression: Clear current tier on Mythic difficulty",
              "Guild Ranking: Maintain top 500 EU ranking",
              "Roster Development: Build a strong, consistent 25-man roster",
              "Community Growth: Expand our social member base"
            ]
          },
          rightColumn: {
            title: "Long-term Vision",
            items: [
              "Consistent Progression: Maintain steady Mythic progression each tier",
              "Community Building: Create a welcoming environment for all players",
              "Player Development: Help members improve and achieve their goals",
              "Guild Stability: Build a sustainable, long-term guild structure"
            ]
          }
        }
      },
      
      // Block 10: Contact
      {
        id: "block-contact",
        type: "contact",
        order: 9,
        data: {
          sectionTitle: "Ready to Join Us?",
          icon: "contact",
          description: "If you're interested in joining our guild, please reach out to us through one of the following channels:",
          discord: {
            label: "Join our Discord",
            url: "https://discord.gg/yourguild"
          },
          email: {
            label: "Contact Officers",
            url: "mailto:officers@yourguild.com"
          },
          footer: "We typically respond to applications within 24-48 hours. Don't hesitate to reach out with any questions!"
        }
      }
    ]
  };
}

export default router;

