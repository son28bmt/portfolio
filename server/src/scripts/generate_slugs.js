/**
 * Slug Generation Script for existing projects
 * Updated to force sync first
 * Run with: node src/scripts/generate_slugs.js
 */
const { sequelize } = require('../config/db');
const Project = require('../models/Project');

const slugify = (text) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-') 
    .replace(/[^\w-]+/g, '') 
    .replace(/--+/g, '-') 
    .replace(/^-+/, '') 
    .replace(/-+$/, ''); 
};

async function generateSlugs() {
  try {
    console.log('🚀 Syncing database schema...');
    // Force sync specifically for the Project model to add the 'slug' column
    await sequelize.sync({ alter: true });
    console.log('✅ Schema sync complete.');

    console.log('🚀 Starting slug generation for existing projects...');
    const projects = await Project.findAll();
    
    let count = 0;
    for (const project of projects) {
      if (!project.slug) {
        const newSlug = slugify(project.title);
        project.slug = newSlug;
        await project.save();
        console.log(`✅ Generated slug for: "${project.title}" -> ${project.slug}`);
        count++;
      }
    }
    
    console.log(`✨ Done! Generated slugs for ${count} projects.`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

generateSlugs();
