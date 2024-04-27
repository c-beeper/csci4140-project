/*
* ======Simulation Game Plugin for RPG MAker MV======
* ======CSCI4140 Project======
*/

//------Plugin Descriptions------
/*:
* @plugindesc This plugin adds simulation game support to RPG Maker, making it possible to create simulation games.
* @author 1155160250
* @version 1.0.0
*
* @param maxTier
* @text Maximal Tier
* @desc The maximal tier in the game. If you do not want multiple tiers, just set this to 1.
* @type number
* @default 5
* @min 1
*
* @param tierVariable
* @text Variable That Associate with the Tier
* @desc The variable in the game that represent the tier. It is recommended to set this to a variable with large index so that it would not be accidentally modified by other events.
* @type variable
* @default 20
*
* @param buildings
* @text Building List
* @type struct<Building>[]
*
* @help
* Simulation Game Plugin, aka. CSCI4140 Project
* =============================================================================
*  Introduction
* =============================================================================
*
* This plugin allows you to create simulation games using RPG Maker. 
* 
* Currently no functions are implemented.
* =============================================================================
*  Basic Usage
* =============================================================================
*/

//------Structure of the Building------
/*~struct~Building:
*
* @param name
* @text Building Name
* @desc The name of the building.
* @default New Building
*
* @param description
* @text Building Description
* @desc The description of the building.
* @default "This displays the default description of the building. Contact the author if this appears in the game."
* @type note
*
* @param image
* @text Building Image
* @desc The image of this building that appears in the game if the building is constructed. Recommend size: 48x48 pixels.
* @type file
* @default img/pictures/
* @require 1
*
* @param cost
* @text Building Cost
* @desc The cost for constructing one of this building in the construction area.
* @type number
* @default 100
* @min 0
* 
* @param profit
* @text Building's Profit Every Hour
* @desc The profit that the building would earn every hour. (in debug mode: every minute/second)
* @type number
* @default 1
* @min 0
*
* @param isInfinite
* @text Can Be Infinitely Constructed
* @desc If this parameter is set to true, the building can be constructed infinitely if it is unlocked.
* @type boolean
* @default true
*
* @param isWalkable
* @text Can Be Walked On
* @desc If this parameter is set to true, the building can be walked on by the game characters. It is recommended to set this as true only for roads.
* @type boolean
* @default false
*
* @param minShopTier
* @text Minimal Tier to Appear in Shop
* @desc The minimum tier requirement for the building to appear in the building shop. If you want it to be unshoppable, just set this to be larger than maximum tier.
* @type number
* @default 1
* @min 1
*
* @param triggerEvent
* @text Associated Event
* @desc Create a common event and select it here if you want to trigger some event when game characters are interacting with this building.
* @type common_event
*/
