-- Database: Digital Marketplace
-- Note: Sequelize will generate these automatically if sync is enabled.

-- 1. categories
CREATE TABLE `Categories` (
  `id` CHAR(36) BINARY NOT NULL,
  `name` VARCHAR(255) NOT NULL UNIQUE,
  `createdAt` DATETIME NOT NULL,
  `updatedAt` DATETIME NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

-- 2. products
CREATE TABLE `Products` (
  `id` CHAR(36) BINARY NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT,
  `price` DECIMAL(15,0) NOT NULL,
  `quantity` INTEGER DEFAULT 0,
  `categoryId` CHAR(36) BINARY,
  `createdAt` DATETIME NOT NULL,
  `updatedAt` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`categoryId`) REFERENCES `Categories` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

-- 3. stock_items
CREATE TABLE `StockItems` (
  `id` CHAR(36) BINARY NOT NULL,
  `productId` CHAR(36) BINARY,
  `data` TEXT NOT NULL,
  `status` ENUM('available', 'sold') DEFAULT 'available',
  `createdAt` DATETIME NOT NULL,
  `updatedAt` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`productId`) REFERENCES `Products` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- 4. orders
CREATE TABLE `Orders` (
  `id` CHAR(36) BINARY NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `status` ENUM('pending', 'paid', 'failed') DEFAULT 'pending',
  `payment_ref` VARCHAR(255) UNIQUE,
  `paid_at` DATETIME,
  `productId` CHAR(36) BINARY,
  `stockItemId` CHAR(36) BINARY,
  `createdAt` DATETIME NOT NULL,
  `updatedAt` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`productId`) REFERENCES `Products` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY (`stockItemId`) REFERENCES `StockItems` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;
