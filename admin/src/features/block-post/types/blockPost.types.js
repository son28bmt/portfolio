/** @typedef {'header' | 'text' | 'footer'} BlockType */
/** @typedef {'left' | 'center' | 'right'} BlockAlign */

/** @typedef {Object} TemplateBlock
 * @property {string} id
 * @property {BlockType} type
 * @property {number} x
 * @property {number} y
 * @property {number} w
 * @property {number} h
 * @property {BlockAlign} align
 * @property {Record<string, unknown>} props
 */

/** @typedef {Object} LayoutTemplate
 * @property {string} id
 * @property {string} name
 * @property {TemplateBlock[]} blocks
 */

/** @typedef {Object} BlockPostState
 * @property {TemplateBlock[]} blocks
 * @property {string | null} selectedBlockId
 * @property {string | null} activeBlockId
 * @property {BlockType | null} pendingBlockType
 * @property {(type: BlockType, position?: {x:number, y:number}) => void} addBlock
 * @property {(id: string, updates: Partial<TemplateBlock>) => void} updateBlock
 * @property {(id: string, position: {x:number, y:number, w:number, h:number}) => void} updatePosition
 * @property {(id: string) => void} removeBlock
 * @property {(id: string | null) => void} selectBlock
 * @property {(id: string | null) => void} setActiveBlock
 * @property {(type: BlockType | null) => void} setPendingBlockType
 */

export {};