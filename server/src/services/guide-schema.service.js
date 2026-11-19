const { DataTypes } = require('sequelize');
let sequelize;

const ensureTable = async (tableName, definition) => {
  const query = sequelize.getQueryInterface();
  const tables = await query.showAllTables();
  const exists = tables.some(table => String(typeof table === 'object' ? table.tableName : table).toLowerCase() === tableName.toLowerCase());
  if (!exists) await query.createTable(tableName, definition);
};

const ensureColumns = async (tableName, definitions) => {
  const query = sequelize.getQueryInterface();
  const tables = await query.showAllTables();
  const actualName = tables
    .map(table => String(typeof table === 'object' ? table.tableName : table))
    .find(name => name.toLowerCase() === tableName.toLowerCase());
  if (!actualName) return;

  let columns;
  try {
    columns = await query.describeTable(actualName);
  } catch {
    return;
  }
  for (const [name, definition] of Object.entries(definitions)) {
    if (!columns[name]) {
      await query.addColumn(actualName, name, definition);
      columns[name] = definition;
    }
  }
};

const ensureIndex = async (tableName, name, fields) => {
  const query = sequelize.getQueryInterface();
  try {
    const indexes = await query.showIndex(tableName);
    const names = indexes.map(index => index.name || index.Key_name || index.key_name);
    if (!names.includes(name)) await query.addIndex(tableName, fields, { name });
  } catch {
    // The table may be managed externally or unavailable during rollout.
  }
};

let ensured = false;
let inFlight = null;

const ensureGuideSchema = async () => {
  if (!sequelize) ({ sequelize } = require('../config/db'));
  if (ensured) return;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const query = sequelize.getQueryInterface();
    await ensureTable('guide_topics', {
      id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true, allowNull: false },
      name: { type: DataTypes.STRING(100), allowNull: false },
      slug: { type: DataTypes.STRING(120), allowNull: false, unique: true },
      description: { type: DataTypes.TEXT, allowNull: true },
      sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      is_visible: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    });
    await ensureTable('guides', {
      id: { type: DataTypes.CHAR(36), allowNull: false, primaryKey: true },
      slug: { type: DataTypes.STRING(191), allowNull: false, unique: true },
      title: { type: DataTypes.STRING(255), allowNull: false },
      excerpt: { type: DataTypes.TEXT, allowNull: true },
      content: { type: DataTypes.TEXT('long'), allowNull: false },
      image: { type: DataTypes.TEXT, allowNull: true },
      topic_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, references: { model: 'guide_topics', key: 'id' }, onDelete: 'SET NULL' },
      status: { type: DataTypes.ENUM('draft', 'published'), allowNull: false, defaultValue: 'draft' },
      read_time: { type: DataTypes.STRING(20), allowNull: false, defaultValue: '5 min' },
      published_at: { type: DataTypes.DATE, allowNull: true },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    });
    await ensureIndex('guides', 'guides_status_published_at_index', ['status', 'published_at']);
    await ensureIndex('guides', 'guides_topic_id_index', ['topic_id']);

    await ensureTable('guide_question_templates', {
      id: { type: DataTypes.CHAR(36), allowNull: false, primaryKey: true },
      guide_id: { type: DataTypes.CHAR(36), allowNull: true, references: { model: 'guides', key: 'id' }, onDelete: 'SET NULL' },
      name: { type: DataTypes.STRING(160), allowNull: false },
      is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      fields: { type: DataTypes.JSON, allowNull: false },
      created_by: { type: DataTypes.STRING(191), allowNull: true },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    });
    await ensureIndex('guide_question_templates', 'idx_guide_question_templates_guide_active', ['guide_id', 'is_active']);

    await ensureColumns('admins', {
      role: { type: DataTypes.ENUM('owner', 'editor', 'support'), allowNull: false, defaultValue: 'owner' },
    });
    await ensureColumns('users', {
      role: { type: DataTypes.ENUM('owner', 'editor', 'support'), allowNull: true, defaultValue: null },
    });
    await ensureColumns('LiveChatMessages', {
      userId: { type: DataTypes.CHAR(36), allowNull: true },
      purchaseStatus: { type: DataTypes.ENUM('unknown', 'purchased', 'not_purchased'), allowNull: true },
      assignedBy: { type: DataTypes.STRING(191), allowNull: true },
      assignedAt: { type: DataTypes.DATE, allowNull: true },
      assignmentNotes: { type: DataTypes.TEXT, allowNull: true },
      packageType: { type: DataTypes.STRING(120), allowNull: true },
      printerModel: { type: DataTypes.STRING(160), allowNull: true },
      messageType: { type: DataTypes.ENUM('text', 'guide_question'), allowNull: true },
      guideContext: { type: DataTypes.JSON, allowNull: true },
      questionSnapshot: { type: DataTypes.JSON, allowNull: true },
    });
    await ensureIndex('LiveChatMessages', 'LiveChatMessages_userId', ['userId']);

    ensured = true;
    console.info('[Schema] Guide, question template, role, and support chat schema ready.');
  })();

  try {
    await inFlight;
  } finally {
    inFlight = null;
  }
};

module.exports = { ensureGuideSchema };