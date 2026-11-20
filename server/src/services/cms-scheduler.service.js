const { Op, literal } = require('sequelize');
const { Blog, Guide } = require('../models');
const { createPostRevision } = require('./post-revision.service');

let timer;
let schemaWarningLogged = false;

async function publishDue(Model, postType) {
  const now = new Date();
  const due = await Model.findAll({ where: { status: 'scheduled', scheduledAt: { [Op.lte]: now } } });
  let publishedCount = 0;
  for (const post of due) {
    const [claimed] = await Model.update(
      { status: 'published', publishedAt: post.publishedAt || now, scheduledAt: null, cmsVersion: literal('cms_version + 1') },
      { where: { id: post.id, status: 'scheduled', scheduledAt: { [Op.lte]: now } } },
    );
    if (!claimed) continue;
    publishedCount += 1;
    const published = await Model.findByPk(post.id);
    await createPostRevision({ postType, post: published, action: 'published', authorId: post.authorId || null });
  }
  return publishedCount;
}

async function publishScheduledPosts() {
  const [blogs, guides] = await Promise.all([publishDue(Blog, 'blog'), publishDue(Guide, 'guide')]);
  return { blogs, guides };
}

function startCmsScheduler() {
  if (timer) return timer;
  const run = () => publishScheduledPosts().then(() => { schemaWarningLogged = false; }).catch(error => {
    if (!schemaWarningLogged && /unknown column|doesn't exist|does not exist/i.test(error.message)) {
      schemaWarningLogged = true;
      console.warn('[CMS scheduler] CMS schema is not installed; run server/scripts/sql/cms-editor-migration.sql.');
      return;
    }
    console.error('[CMS scheduler]', error.message);
  });
  timer = setInterval(run, 60 * 1000);
  if (typeof timer.unref === 'function') timer.unref();
  setTimeout(run, 5000);
  return timer;
}

module.exports = { publishDue, publishScheduledPosts, startCmsScheduler };