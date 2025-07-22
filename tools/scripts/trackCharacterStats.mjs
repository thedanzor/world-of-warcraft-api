import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import ora from 'ora';
import chalk from 'chalk';

// Configuration
const WEEKS_TO_CHECK = 7;

// Add debug logging for the path resolution
const repoRoot = execSync('git rev-parse --show-toplevel').toString().trim();
console.log('Repository root:', repoRoot);

const GUILD_DATA_PATH = path.resolve(repoRoot, 'data/guildData.json'); // Note the double 'l'
console.log('Looking for guild data at:', GUILD_DATA_PATH);

function calculateParse(value, allValues) {
    const validValues = allValues.filter(v => v !== undefined && v !== null && v !== 0);
    if (validValues.length === 0 || !value) return 0;
    
    const max = Math.max(...validValues);
    const min = Math.min(...validValues);
    
    // If all values are the same, return 100 for non-zero values
    if (max === min) return value > 0 ? 100 : 0;
    
    return Math.round(((value - min) / (max - min)) * 100);
}

function getMythicBossesKilled(character) {
    if (!character.raidHistory?.instances?.length) return 0;
    
    let mythicKills = 0;
    character.raidHistory.instances.forEach(instance => {
        if (instance.instance.name === 'Nerub-ar Palace') {
            instance.modes.forEach(mode => {
                if (mode.difficulty.name === 'Mythic') {
                mythicKills = mode.progress.encounters.length
                }
            });
        }
    });
    
    return mythicKills;
}

function getCommitsInLastWeeks(weeks) {
    const date = new Date();
    const millisecondsPerWeek = 7 * 24 * 60 * 60 * 1000;
    const pastDate = new Date(Date.now() - (weeks * millisecondsPerWeek));
    const since = pastDate.toISOString();
    
    console.log(`Looking for commits since: ${since}`);
    
    try {
        const command = `git log --since="${since}" --format="%H %ct" -- "data/guildData.json" "guilldData.json"`;
        console.log(`Running command: ${command}`);
        
        const output = execSync(
            command,
            {
                maxBuffer: 1024 * 1024 * 1000,
                encoding: 'utf8'
            }
        );
        
        // If no commits found, return empty array
        if (!output.trim()) {
            console.log('No commits found in the specified time range');
            return [];
        }

        const commits = output.split('\n')
            .filter(line => line.trim())
            .map(line => {
                const [hash, timestamp] = line.split(' ');
                return {
                    hash,
                    timestamp: parseInt(timestamp) * 1000
                };
            });
        
        console.log(`Found ${commits.length} commits with changes to data/guildData.json`);
        return commits;
    } catch (error) {
        console.error('Error getting commit history:', error.message);
        return [];
    }
}

function getFileFromCommit(hash) {
    try {
        // For the current/unstaged file, return null hash to indicate special handling
        if (hash === 'current') {
            const content = fs.readFileSync(GUILD_DATA_PATH, 'utf8');
            return JSON.parse(content);
        }

        // Try all possible file locations
        const possiblePaths = [
            'data/guildData.json',
            'guilldData.json' // This is a typo that is in the git history
        ];

        let content;
        for (const filePath of possiblePaths) {
            try {
                content = execSync(
                    `git cat-file -p ${hash}:${filePath}`,
                    {
                        maxBuffer: 1024 * 1024 * 100,
                        encoding: 'utf8'
                    }
                );
                console.log(`Successfully found file at ${filePath} in commit ${hash.substring(0, 7)}`);
                break;
            } catch (error) {
                // Continue to next path if this one fails
                continue;
            }
        }

        if (!content) {
            throw new Error('File not found in any expected location');
        }
        
        try {
            return JSON.parse(content);
        } catch (parseError) {
            console.error(`Error parsing JSON from commit ${hash}:`, parseError.message);
            return null;
        }
    } catch (error) {
        console.error(`Error reading file from commit ${hash}:`, error.message);
        return null;
    }
}

function extractCharacterStats(character, allCharacters) {
    // Get all values for parsing
    const allItemLevels = allCharacters.map(c => c.itemlevel?.average || 0);
    const allMplusScores = allCharacters.map(c => c.mplus?.current_mythic_rating?.rating || 0);
    const allPvpRatings = allCharacters.map(c => c.pvp?.rating || 0);
    const allBossesKilled = allCharacters.map(c => getMythicBossesKilled(c));

    // Calculate individual values
    const itemLevel = character.itemlevel?.average || 0;
    const mplusScore = character.mplus?.current_mythic_rating?.rating || 0;
    const pvpRating = character.pvp?.rating || 0;
    const bossesKilled = getMythicBossesKilled(character);

    // Calculate values directly without spinner updates
    const itemLevelParse = calculateParse(itemLevel, allItemLevels);
    const mplusParse = calculateParse(mplusScore, allMplusScores);
    const pvpParse = calculateParse(pvpRating, allPvpRatings);
    const bossKillParse = calculateParse(bossesKilled, allBossesKilled);

    // Calculate total parse (average of all parses)
    const totalParse = Math.round(
        (itemLevelParse + mplusParse + pvpParse + bossKillParse) / 4
    );

    const currentYear = new Date().getFullYear();
    const stats2024 = currentYear === 2024 ? {
        itemlevel_parse: itemLevelParse,
        mplus_parse: mplusParse,
        pvp_parse: pvpParse,
        mythic_bosses_parse: bossKillParse,
        total_parse: totalParse
    } : character.stats?.['2024'] || {};

    return {
        itemlevel: itemLevel,
        mplus: mplusScore,
        pvp: pvpRating,
        mythic_bosses: bossesKilled,
        2024: stats2024
    };
}

async function main() {
    console.log(chalk.blue.bold('\n🔍 Starting Character Stats Tracking\n'));
    
    // Get all relevant commits
    const commitSpinner = ora('Fetching git commits...').start();
    const commits = getCommitsInLastWeeks(WEEKS_TO_CHECK);
    
    if (commits.length === 0) {
        commitSpinner.info('No previous commits found - will only process current data');
    } else {
        commitSpinner.succeed(`Found ${chalk.green(commits.length)} commits to process`);
    }

    // Track all character names and their presence in commits
    const characterPresence = new Map();
    let firstCommitCharacters = new Set();
    let currentCharacters = new Set();

    // Process commits with progress
    const processSpinner = ora().start();
    let processed = 0;
    const characterStats = {};

    // Add current/unstaged file to the commits array
    const allCommits = [...commits, { hash: 'current', timestamp: Date.now() }];

    for (const commit of allCommits) {
        processed++;
        processSpinner.text = chalk.blue(`Processing commit ${chalk.yellow(commit.hash.substring(0, 7))} [${processed}/${allCommits.length}]`);
        
        const data = getFileFromCommit(commit.hash);
        
        if (!data || !data.data) {
            console.log(chalk.yellow(`  ⚠️  Skipping commit ${commit.hash.substring(0, 7)} - Unable to read data`));
            continue;
        }

        const dataArray = data.data;
        if (!Array.isArray(dataArray)) {
            console.log(chalk.yellow(`  ⚠️  Skipping commit ${commit.hash.substring(0, 7)} - Invalid data format`));
            continue;
        }

        // Store first commit characters only if we have previous commits
        if (commits.length > 0 && commit === commits[commits.length - 1]) {
            firstCommitCharacters = new Set(dataArray.map(char => char?.name).filter(Boolean));
        }
        
        // Always store current characters
        if (commit.hash === 'current') {
            currentCharacters = new Set(dataArray.map(char => char?.name).filter(Boolean));
        }

        // Process characters
        for (const character of dataArray) {
            if (!character?.name) continue;
            
            if (!characterStats[character.name]) {
                characterStats[character.name] = { stats: {} };
            }
            characterStats[character.name].stats[commit.timestamp] = extractCharacterStats(character, dataArray);
        }
    }

    // Calculate character differences with timestamps
    const changes = {
        added: [],
        removed: []
    };

    // Only calculate changes if we have previous commits
    if (commits.length > 0) {
        // Characters removed
        const removedCharacters = [...firstCommitCharacters].filter(char => !currentCharacters.has(char));
        changes.removed = removedCharacters;

        // Characters added
        const addedCharacters = [...currentCharacters].filter(char => !firstCommitCharacters.has(char));
        changes.added = addedCharacters;
    }

    // Take only top 5 from each category
    const recentChanges = {
        added: changes.added.slice(0, 5),
        removed: changes.removed.slice(0, 5)
    };

    // Read and update current guild data
    const updateSpinner = ora('Updating guild data...').start();

    try {
        if (!fs.existsSync(GUILD_DATA_PATH)) {
            updateSpinner.fail(`Guild data file not found at: ${GUILD_DATA_PATH}`);
            console.log('Current working directory:', process.cwd());
            console.log('Directory contents:', fs.readdirSync(path.dirname(GUILD_DATA_PATH)));
            throw new Error('Guild data file not found');
        }
        
        const currentGuildData = JSON.parse(fs.readFileSync(GUILD_DATA_PATH, 'utf8'));
        
        if (!currentGuildData?.data || !Array.isArray(currentGuildData.data)) {
            throw new Error('Invalid guild data format');
        }

        // Update the data array inside the object
        const updatedGuildData = {
            ...currentGuildData,
            data: currentGuildData.data.map(character => {
                if (character?.name && characterStats[character.name]) {
                    return {
                        ...character,
                        stats: {
                            ...character.stats || {},
                            ...characterStats[character.name].stats || {}
                        }
                    };
                }
                return character;
            }),
            changes: recentChanges
        };

        // Write updated data
        fs.writeFileSync(
            GUILD_DATA_PATH,
            JSON.stringify(updatedGuildData, null, 2),
            'utf8'
        ); 
        updateSpinner.succeed('Successfully updated guild data with historical stats');

        // Summary
        console.log(chalk.blue.bold('\n📊 Summary:'));
        console.log(`  📝 Processed ${chalk.green(allCommits.length)} commits`);
        console.log(`  👤 Updated ${chalk.green(Object.keys(characterStats).length)} characters`);
        console.log(`  📅 Covering ${chalk.green(commits.length ? WEEKS_TO_CHECK : 0)} weeks of history`);
        
        if (commits.length > 0) {
            console.log(chalk.blue.bold('\n👥 Character Changes:'));
            console.log(chalk.red(`  Removed Characters (${recentChanges.removed.length}):`));
            recentChanges.removed.forEach(char => console.log(`    - ${char}`));
            console.log(chalk.green(`  Added Characters (${recentChanges.added.length}):`));
            recentChanges.added.forEach(char => console.log(`    - ${char}`));
        }
        console.log('\n');
    } catch (error) {
        updateSpinner.fail(`Error updating guild data: ${error.message}`);
        throw error;
    }
}

main().catch(error => {
    console.error('Error:', error);
    process.exit(1);
}); 