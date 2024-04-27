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
* @param emptyImageName
* @text File Name of Empty Construction Area Image
* @desc File name of the image of the empty construction area. The image should be put into img/characters/ folder.
* @default !SimGame1
*
* @param emptyImageOffset
* @text Offset of the Empty Construction Area Image
* @desc The offset of the image of the empty construction area in the file. Same with the character images, start from top-left 0, end with bottom-right 7.
* @type number
* @default 0
* @max 7
* @min 0
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
* @default "This displays the default description of the building.\nContact the author if this appears in the game."
* @type note
*
* @param imageName
* @text File Name of the Building Image
* @desc File name of the image of the building that appears in the game. The image should be put into img/characters/ folder.
* @default !SimGame1
*
* @param imageOffset
* @text Offset of the Building Image
* @desc The offset of the image in the file. Same with the character images, start from top-left 0, end with bottom-right 7.
* @type number
* @default 1
* @max 7
* @min 0
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

//Global variable (namespace) of the plugin
var SimGamePlugin = SimGamePlugin || {};
SimGamePlugin.Parameters = PluginManager.parameters('SimulationGame');
SimGamePlugin.Params = SimGamePlugin.Params || {};

//Retrieve parameters
SimGamePlugin.Params.maxTier = Number(SimGamePlugin.Parameters['maxTier']);
SimGamePlugin.Params.tierVariable = Number(SimGamePlugin.Parameters['tierVariable']);
SimGamePlugin.Params.emptyImageName = String(SimGamePlugin.Parameters['emptyImageName']);
SimGamePlugin.Params.emptyImageOffset = Number(SimGamePlugin.Parameters['emptyImageOffset']);
try {
    SimGamePlugin.Params.buildings = JSON.parse(SimGamePlugin.Parameters['buildings']).map(function(building){
        return JSON.parse(building);
    });
}
catch (err) {
    console.error(err);
    //do nothing
}

//Main function of the plugin
(function(){
    //class SimGame: the main class of this plugin
    function SimGame(){
        //initial tier is set to 1
        this.tier = 1;
        //the list consisting of all constructed buildings, initially empty
        this.map = [];
        //the list consisting of all unlocked buildings, initially empty
        this.unlocks = [];
        //what mode the game is currently in. 0 - normal; 1 - building
        this.mode = 0;
    }
    SimGame.prototype.constructor = SimGame;

    SimGame.prototype.debug = function(mapId,eventId){
        //this is the debug function; it would change from time to time
        $gameMessage.add("map Id: " + mapId + "; event ID: " + eventId);
        //var exampleList = [];
        //exampleList.push({mapId: mapId, eventId: eventId});
        //var checkExist = exampleList.find((area) => {return area.mapId === mapId && area.eventId === eventId});
        //$gameMessage.add(checkExist.mapId);
        $gameMessage.add("tier: " + SimGamePlugin.SimGame.tier);
        //set image to the buildings
        $gameMap.event(eventId).setImage(SimGamePlugin.Params.buildings[0]["imageName"],Number(SimGamePlugin.Params.buildings[0]["imageOffset"]));
    };

    SimGame.prototype.addConstructArea = function(minTier,mapId,eventId){
        //add a new event to the construction area
        var areaExist = this.map.find(function(area){return area.mapId === mapId && area.eventId === eventId});
        if(areaExist){
            //the area exists
            //modify the event appearance
            this.displayBuilding(areaExist);
        }
        else{
            this.map.push({
                mapId: mapId,
                eventId: eventId,
                minTier: minTier,
                buildingId: -1 //-1 stands for no building
            });
            //modify the event appearance
            this.displayBuilding(this.map[this.map.length - 1]);
        }
    };

    SimGame.prototype.displayBuilding = function(area){
        //display the building in the map; "area" is a this.map object
        if(SimGamePlugin.SimGame.tier >= area.minTier){
            //only display something when the current tier is larger than the minTier of this area
            if(area.buildingId === -1){
                //show the empty image
                $gameMap.event(area.eventId).setImage(SimGamePlugin.Params.emptyImageName,SimGamePlugin.Params.emptyImageOffset);
                //an empty area is walkable
                $gameMap.event(area.eventId).setPriorityType(0);
            }
            else{
                //set the image as the image of the building
                $gameMap.event(area.eventId).setImage(SimGamePlugin.Params.buildings[area.buildingId]["imageName"],Number(SimGamePlugin.Params.buildings[area.buildingId]["imageOffset"]));
                if(SimGamePlugin.Params.buildings[area.buildingId]["isWalkable"]){
                    $gameMap.event(area.eventId).setPriorityType(0);
                }
                else{
                    $gameMap.event(area.eventId).setPriorityType(1);
                }
            }
        }
    };

    SimGame.prototype.enterBuildingMode = function(mapId){
        //enter the building mode
        this.detailAndChangeMode(mapId);
    };

    SimGame.prototype.detailAndChangeMode = function(mapId){
        //easier-to-implement building mode (no interface)
        //save the original information for recovery
        this.originalFileName = $gamePlayer.characterName();
        this.originalFileOffset = $gamePlayer.characterIndex();
        this.originalX = $gamePlayer.x;
        this.originalY = $gamePlayer.y;
        //set the character image to the selector
        $gamePlayer.setImage("SimGameSpecial",0);
        //change the walkable settings
        this.changePriorityStatus(mapId,0);
        //enter the building mode
        this.mode = 1;
        //do something in the middle
        //when exiting the mode:
        
    };

    SimGame.prototype.exitBuildingMode = function(mapId){
        this.mode = 0;
        $gamePlayer.locate(this.originalX,this.originalY);
        this.changePriorityStatus(mapId,1);
        $gamePlayer.setImage(this.originalFileName,this.originalFileOffset);
    }

    SimGame.prototype.changePriorityStatus = function(mapId,mode){
        //used for building mode: every area should be walkable by the character (now the selector)
        if(mode === 0){
            //mode = 0: set the status of all areas into "walkable"
            var areas = this.map.filter((area) => {return area.mapId === mapId});
            areas.forEach((value,index,array) => {
                $gameMap.event(value.eventId).setPriorityType(0);
            });
        }
        else{
            //mode = 1: recover the original status
            var areas = this.map.filter((area) => {return area.mapId === mapId});
            areas.forEach((value,index,array) => {
                if(value.buildingId === -1 || SimGamePlugin.Params.buildings[value.buildingId]["isWalkable"]){
                    $gameMap.event(value.eventId).setPriorityType(0);
                }
                else{
                    $gameMap.event(value.eventId).setPriorityType(1);
                }
            });
        }
    };

    SimGame.prototype.constructBuilding = function(mapId,eventId,buildingId){
        //construct a building on an empty construction area
        var area = this.map.find(function(area){return area.mapId === mapId && area.eventId === eventId});
        area.buildingId = buildingId;
        this.displayBuilding(area);
        //deal with "profits" here
    };

    SimGame.prototype.removeBuilding = function(mapId,eventId){
        //remove an existing building
        var area = this.map.find(function(area){return area.mapId === mapId && area.eventId === eventId});
        area.buildingId = -1;
        this.displayBuilding(area);
        //deal with "profits" here
    }

    SimGame.prototype.checkAndAcquireProfit = function(){
        //checks the current profits, and acquire them
    };

    SimGame.prototype.triggerBuildingShop = function(){
        //invokes the building shop interface
    };

    SimGame.prototype.unlockBuilding = function(buildingId){
        //add the building with id buildingId to the unlocks list
        this.unlocks.push(buildingId);
    };

    document.addEventListener("keydown",(event) => {
        //listen for the keydown actions for enter and esc in building mode
        if(SimGamePlugin.SimGame.mode === 1){
            //trigger these only if in building mode
            if(event.keyCode === 13){
                //enter pressed
                var eventId = $gameMap.eventIdXy($gamePlayer.x,$gamePlayer.y);
                if(eventId !== 0){
                    var area = SimGamePlugin.SimGame.map.find(function(area){return area.mapId === $gameMap.mapId() && area.eventId === eventId});
                    if(SimGamePlugin.SimGame.tier >= area.minTier){
                        if(area.buildingId === -1){
                            $gameMessage.add("This area is empty.\nWhat would you like to do?");
                            $gameMessage.setChoices(["Construct Buildings","Cancel"],0,1);
                            $gameMessage.setChoiceCallback((n) => {
                                if(n === 0){
                                    //"construct buildings" selected
                                    SimGamePlugin.SimGame.constructBuilding($gameMap.mapId(),eventId,0);
                                }
                            });
                        }
                        else{
                            $gameMessage.add(SimGamePlugin.Params.buildings[area.buildingId]["name"]);
                            $gameMessage.add(JSON.parse(SimGamePlugin.Params.buildings[area.buildingId]["description"]));
                            $gameMessage.add("Profits per hour: " + SimGamePlugin.Params.buildings[area.buildingId]["profit"]);
                            $gameMessage.add("What would you like to do?");
                            $gameMessage.setChoices(["Remove Building","Cancel"],0,1);
                            $gameMessage.setChoiceCallback((n) => {
                                if(n === 0){
                                    //"remove building" selected
                                    SimGamePlugin.SimGame.removeBuilding($gameMap.mapId(),eventId);
                                }
                            });
                        }
                    }
                    else{
                        $gameMessage.add("This area is currently locked. It will be unlocked in\ntier " + area.minTier);
                    }
                }
            }
            else if(event.keyCode === 27){
                //esc pressed
                $gameMessage.add("Exited from building mode.");
                SimGamePlugin.SimGame.exitBuildingMode($gameMap.mapId());
            }
        }
        
    });

    //plugin commands
    var _Game_Interpreter_pluginCommand_SimGame = Game_Interpreter.prototype.pluginCommand;
    Game_Interpreter.prototype.pluginCommand = function(command, args) {
        _Game_Interpreter_pluginCommand_SimGame.call(this, command, args);
        if (command === 'SimulationGame') {
            switch (args[0]) {
                case 'setAsConstructArea':
                    //setAsConstructArea minTier
                    //SimGame.prototype.addConstructArea = function(minTier,mapId,eventId);
                    SimGamePlugin.SimGame.addConstructArea(Number(args[1]),this._mapId,this._eventId);
                    break;
                case 'enterBuildingMode':
                    //enterBuildingMode
                    //SimGame.prototype.enterBuildingMode = function(mapId);
                    SimGamePlugin.SimGame.enterBuildingMode(this._mapId);
                    break;
                case 'checkAndAcquireProfit':
                    //checkAndAcquireProfit
                    SimGamePlugin.SimGame.checkAndAcquireProfit();
                    break;
                case 'triggerBuildingShop':
                    //triggerBuildingShop
                    //SceneManager.push(Scene_QuestBook);
                    SimGamePlugin.SimGame.triggerBuildingShop();
                    break;
                case 'unlockBuilding':
                    //unlockBuilding buildingId
                    //SimGame.prototype.unlockBuilding = function(buildingId);
                    SimGamePlugin.SimGame.unlockBuilding(Number(args[1]));
                    break;
                case 'debug':
                    //just for debugging purposes
                    SimGamePlugin.SimGame.debug(this._mapId,this._eventId);
                    break;
            }
        }
    };

    //Create the SimGame-related objects when creating game objects
    var _DataManager_createGameObjects_SimGame = DataManager.createGameObjects;
    DataManager.createGameObjects = function() {
        _DataManager_createGameObjects_SimGame.call(this);
        if (typeof $dataCommonEvents !== "undefined") {
            SimGamePlugin.SimGame = new SimGame();
            //link the tier variable
            $gameVariables.setValue(SimGamePlugin.Params.tierVariable,SimGamePlugin.SimGame.tier);
        }
    };

    //link the tier variable
    var _Game_Interpreter_operateVariable_SimGame = Game_Interpreter.prototype.operateVariable;
    Game_Interpreter.prototype.operateVariable = function(variableId, operationType, value){
        _Game_Interpreter_operateVariable_SimGame.call(this,variableId, operationType, value);
        if(variableId === SimGamePlugin.Params.tierVariable){
            SimGamePlugin.SimGame.tier = $gameVariables.value(variableId);
            //validation of the value of tier
            if(SimGamePlugin.SimGame.tier > SimGamePlugin.Params.maxTier){
                SimGamePlugin.SimGame.tier = SimGamePlugin.Params.maxTier;
                $gameVariables.setValue(variableId,SimGamePlugin.Params.maxTier);
            }
            else if(SimGamePlugin.SimGame.tier <= 0){
                SimGamePlugin.SimGame.tier = 1;
                $gameVariables.setValue(variableId,1);
            }
        }
    };
})();
