/**
 * Updated Slug Generation Script
 * Handles Vietnamese accents properly
 */
const { sequelize } = require('../config/db');
const Project = require('../models/Project');

const slugify = (text) => {
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
};

async function generateSlugs() {
  try {
    console.log('🚀 Running enhanced slug generation...');
    const projects = await Project.findAll();
    
    let count = 0;
    for (const project of projects) {
      const newSlug = slugify(project.title);
      if (project.slug !== newSlug) {
        project.slug = newSlug;
        await project.save();
        console.log(`✅ Updated slug for: "${project.title}" -> ${project.slug}`);
        count++;
      }
    }
    
    console.log(`✨ Done! Updated slugs for ${count} projects.`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

generateSlugs();
