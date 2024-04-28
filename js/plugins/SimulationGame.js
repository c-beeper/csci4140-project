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
* @param shopCost
* @text Unlock or Buying Cost
* @desc The cost for buying this building from the building shop. Note that this is different from the construction cost.
* @type number
* @default 1000
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
        //the list consisting of all unlocked finite buildings with their amount left, initially empty
        this.numFinite = [];
        //what mode the game is currently in. 0 - normal; 1 - building
        this.mode = 0;
        //whether the game is currently in another scene; avoid multiple triggering
        this.inOtherScene = false;
    }
    SimGame.prototype.constructor = SimGame;

    SimGame.prototype.debug = function(mapId,eventId){
        //this is the debug function; it would change from time to time
        //set image to the buildings
        $gameMap.event(eventId).setImage(SimGamePlugin.Params.buildings[0]["imageName"],Number(SimGamePlugin.Params.buildings[0]["imageOffset"]));
        //SimGamePlugin.SimGame.unlockBuilding(0);
        //SceneManager.push(Scene_BuildingSelection);
        //var _selectionWindow = new Window_SimGameBuildingSelection();
        //_selectionWindow.start();
        var curDate = new Date();
        curDate = curDate.getTime();
        $gameMessage.add("profit: " + this.calculateProfitsDebug(this.map[0].lastModified,curDate,100));
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
            var curDate = new Date();
            curDate = curDate.getTime();
            this.map.push({
                mapId: mapId,
                eventId: eventId,
                minTier: minTier,
                buildingId: -1, //-1 stands for no building
                lastModified: curDate
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
                if(SimGamePlugin.Params.buildings[area.buildingId]["isWalkable"] === "false" && this.mode === 0){
                    $gameMap.event(area.eventId).setPriorityType(1);
                }
                else{
                    $gameMap.event(area.eventId).setPriorityType(0);
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
        if(this.mode === 1){
            this.mode = 0;
            $gamePlayer.locate(this.originalX,this.originalY);
            this.changePriorityStatus(mapId,1);
            $gamePlayer.setImage(this.originalFileName,this.originalFileOffset);
        }
    };

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
                if(value.buildingId === -1 || SimGamePlugin.Params.buildings[value.buildingId]["isWalkable"] === "true"){
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
        //change the last modified time to the time of constructing the building
        var curDate = new Date();
        curDate = curDate.getTime();
        area.lastModified = curDate;
    };

    SimGame.prototype.removeBuilding = function(mapId,eventId){
        //remove an existing building
        var area = this.map.find(function(area){return area.mapId === mapId && area.eventId === eventId});
        //calculate the profits
        var curDate = new Date();
        curDate = curDate.getTime();
        //change this into normal after finished development
        var curProfit = this.calculateProfitsDebug(area.lastModified,curDate,SimGamePlugin.Params.buildings[area.buildingId]["profit"]);
        $gameParty.gainGold(curProfit);
        //$gameMessage.add("Profits earned: " + curProfit + ", you now have: " + $gameParty.gold());
        area.buildingId = -1;
        area.lastModified = curDate;
        this.displayBuilding(area);
        //deal with "profits" here
    };

    SimGame.prototype.checkAndAcquireProfit = function(){
        //checks the current profits, and acquire them
        var curDate = new Date();
        curDate = curDate.getTime();
        var totProfitPerHour = 0;
        var totProfit = 0;
        this.map.forEach((area) => {
            //iterate through all the areas to calculate the total profit
            if(area.buildingId !== -1){
                totProfitPerHour += Number(SimGamePlugin.Params.buildings[area.buildingId]["profit"]);
                //remember to change this from debug to normal
                totProfit += this.calculateProfitsDebug(area.lastModified,curDate,SimGamePlugin.Params.buildings[area.buildingId]["profit"]);
            }
        });
        $gameMessage.add("Current profit per hour: " + totProfitPerHour);
        $gameMessage.add("Profits accumulated till now: " + totProfit);
        $gameMessage.add("Would you like to collect them?");
        $gameMessage.setChoices(["Yes","No"],0,1);
        $gameMessage.setChoiceCallback((n) => {
            if(n === 0){
                //"yes" selected
                //re-calculate the profits because players may stay at the message dialog for a long time
                curDate = new Date();
                curDate = curDate.getTime();
                totProfit = 0;
                this.map.forEach((area) => {
                    //iterate through all the areas to calculate the total profit
                    if(area.buildingId !== -1){
                        //remember to change this from debug to normal
                        totProfit += this.calculateProfitsDebug(area.lastModified,curDate,SimGamePlugin.Params.buildings[area.buildingId]["profit"]);
                        //reset the last modified time
                        area.lastModified = curDate;
                    }
                });
                $gameParty.gainGold(totProfit);
            }
        });
    };

    SimGame.prototype.calculateProfitsFromDate = function(date1,date2,profit){
        //calculate the profit between two dates
        //date is passed after getTime()
        //calculate how many hours have passed between the two days (date2 - date1)
        //past time in seconds
        var diff = (date2 - date1) / 1000;
        //past time in hours
        diff /= (60 * 60);
        //times the profit
        diff *= profit;
        if(diff < 0){
            //probably the player has changed the system time
            return 0;
        }
        else{
            //round to integers
            return Math.round(diff);
        }
    };

    SimGame.prototype.calculateProfitsDebug = function(date1,date2,profit){
        //calculate the profit using per minute (don't need to wait to see the result)
        //past time in seconds
        var diff = (date2 - date1) / 1000;
        //past time in minutes
        diff /= 60;
        //times the profit
        diff *= profit;
        if(diff < 0){
            //probably the player has changed the system time
            return 0;
        }
        else{
            //round to integers
            return Math.round(diff);
        }
    };

    SimGame.prototype.triggerBuildingShop = function(){
        //invokes the building shop interface
        SceneManager.push(Scene_BuildingShop);
        //change this
        SceneManager.prepareNextScene();
    };

    SimGame.prototype.unlockBuilding = function(buildingId){
        //add the building with id buildingId to the unlocks list
        if(!this.unlocks.includes(buildingId)){
            this.unlocks.push(buildingId);
            if(SimGamePlugin.Params.buildings[buildingId]["isInfinite"] === "false"){
                this.numFinite.push({
                    buildingId: buildingId,
                    amount: 0   //initially 0 
                });
            }
        }
    };

    SimGame.prototype.getFiniteBuilding = function(buildingId, increasement){
        //increase the storage amount of finite buildings
        if(this.unlocks.includes(buildingId) && SimGamePlugin.Params.buildings[buildingId]["isInfinite"] === "false"){
            var amountCount = this.numFinite.find((value) => value.buildingId === buildingId);
            amountCount.amount += increasement;
        }
    };

    SimGame.prototype.consumeFiniteBuilding = function(buildingId, decreasement){
        //decrease the storage amount of finite buildings
        if(this.unlocks.includes(buildingId) && SimGamePlugin.Params.buildings[buildingId]["isInfinite"] === "false"){
            var amountCount = this.numFinite.find((value) => value.buildingId === buildingId);
            amountCount.amount -= decreasement;
            if(amountCount.amount < 0)  amountCount.amount = 0;
        }
    };

    document.addEventListener("keydown",(event) => {
        //listen for the keydown actions for enter and esc in building mode
        if(SimGamePlugin.SimGame.mode === 1 && !$gameMessage.isBusy() && !SimGamePlugin.SimGame.inOtherScene){
            //trigger these only if in building mode
            if(event.keyCode === 13){
                //enter pressed
                //console.log("press of enter is triggered");
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
                                    //SimGamePlugin.SimGame.constructBuilding($gameMap.mapId(),eventId,0);
                                    SimGamePlugin.SimGame.inOtherScene = true;
                                    SceneManager.push(Scene_BuildingSelection);
                                }
                            });
                        }
                        else{
                            $gameMessage.add(SimGamePlugin.Params.buildings[area.buildingId]["name"]);
                            $gameMessage.add(JSON.parse(SimGamePlugin.Params.buildings[area.buildingId]["description"]));
                            $gameMessage.add("Profits per hour: " + SimGamePlugin.Params.buildings[area.buildingId]["profit"]);
                            var curDate = new Date();
                            curDate = curDate.getTime();
                            //change this into normal after finished development
                            var curProfit = SimGamePlugin.SimGame.calculateProfitsDebug(area.lastModified,curDate,SimGamePlugin.Params.buildings[area.buildingId]["profit"]);
                            $gameMessage.add("Profits accumulated: " + curProfit + ", will be acquired upon remmoval.");
                            $gameMessage.add("What would you like to do?");
                            $gameMessage.setChoices(["Remove Building","Cancel"],0,1);
                            $gameMessage.setChoiceCallback((n) => {
                                if(n === 0){
                                    //"remove building" selected
                                    //return the building if it is finite
                                    if(SimGamePlugin.Params.buildings[area.buildingId]["isInfinite"] === "false"){
                                        SimGamePlugin.SimGame.getFiniteBuilding(area.buildingId,1);
                                    }
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
                $gameMessage.add("Do you want to exit the building mode?");
                $gameMessage.setChoices(["Yes","No"],0,1);
                $gameMessage.setChoiceCallback((n) => {
                    if(n === 0){
                        //"yes" selected
                        SimGamePlugin.SimGame.exitBuildingMode($gameMap.mapId());
                    }
                });
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
                    //-1 because the buildingId starts from 0
                    SimGamePlugin.SimGame.unlockBuilding(Number(args[1]) - 1);
                    break;
                case 'addFiniteBuilding':
                    //addFiniteBuilding buildingId amount
                    //-1 because the buildingId starts from 0
                    SimGamePlugin.SimGame.getFiniteBuilding(Number(args[1]) - 1,Number(args[2]));
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

    //Save necessary information when the player saves the game
    var _DataManager_makeSaveContents_SimGame = DataManager.makeSaveContents;
    DataManager.makeSaveContents = function() {
        var contents = _DataManager_makeSaveContents_SimGame.call(this);
        contents.map_SimGame = SimGamePlugin.SimGame.map;
        contents.unlocks_SimGame = SimGamePlugin.SimGame.unlocks;
        contents.numFinite_SimGame = SimGamePlugin.SimGame.numFinite;
        return contents;
    };

    //Reload the saved information upon loading savefiles
    var _DataManager_extractSaveContents_SimGame = DataManager.extractSaveContents;
    DataManager.extractSaveContents = function(contents) {
        _DataManager_extractSaveContents_SimGame.call(this, contents);
        SimGamePlugin.SimGame = new SimGame();
        SimGamePlugin.SimGame.map = contents.map_SimGame;
        SimGamePlugin.SimGame.unlocks = contents.unlocks_SimGame;
        SimGamePlugin.SimGame.numFinite = contents.numFinite_SimGame;
        SimGamePlugin.SimGame.tier = $gameVariables.value(SimGamePlugin.Params.tierVariable);
    };

    //The window for selecting a building from unlocked buildings.
    //This modifies from RPG Maker's original "Window_ItemList" class.
    //Item -> buildingId
    function Window_SimGameBuildingList() {
        this.initialize.apply(this, arguments);
    }

    Window_SimGameBuildingList.prototype = Object.create(Window_Selectable.prototype);
    Window_SimGameBuildingList.prototype.constructor = Window_SimGameBuildingList;

    Window_SimGameBuildingList.prototype.initialize = function(x, y, width, height) {
        Window_Selectable.prototype.initialize.call(this, x, y, width, height);
        this._data = [];
    };

    Window_SimGameBuildingList.prototype.maxCols = function() {
        return 2;
    };

    Window_SimGameBuildingList.prototype.spacing = function() {
        return 48;
    };

    Window_SimGameBuildingList.prototype.maxItems = function() {
        return this._data ? this._data.length : 1;
    };

    Window_SimGameBuildingList.prototype.item = function() {
        var index = this.index();
        return this._data && index >= 0 ? this._data[index] : null;
    };

    Window_SimGameBuildingList.prototype.isCurrentItemEnabled = function() {
        return this.isEnabled(this.item());
    };

    Window_SimGameBuildingList.prototype.includes = function(item) {
        //if the current building is unlocked, return true
        var canFind = SimGamePlugin.SimGame.unlocks.find((value) => {
            return value === item;
        });
        if(canFind){
            return true;
        }
        else{
            return false;
        }
    };

    Window_SimGameBuildingList.prototype.needsNumber = function() {
        return true;
    };

    Window_SimGameBuildingList.prototype.isEnabled = function(id) {
        //If the building is infinite or contain amount left, return true
        if(SimGamePlugin.Params.buildings[id]["isInfinite"] === "false"){
            var curBuilding = SimGamePlugin.SimGame.numFinite.find((value) => {
                return value.buildingId === id;
            })
            if(curBuilding){
                if(curBuilding.amount === 0)    return false;
                else return true;
            }
            else{
                return false;
            }
        }
        else{
            return true;
        }
    };

    Window_SimGameBuildingList.prototype.makeItemList = function() {
        //filter out all the unlocked buildings
        this._data = SimGamePlugin.SimGame.unlocks;
        /*if (this.includes(null)) {
            this._data.push(null);
        }*/
    };

    Window_SimGameBuildingList.prototype.drawItem = function(index) {
        //buildingIds are stored in _data
        var buildingId = this._data[index];
        //console.log(this._data[100]);
        if (buildingId !== undefined) {
            var numberWidth = this.numberWidth();
            var rect = this.itemRect(index);
            rect.width -= this.textPadding();
            this.changePaintOpacity(this.isEnabled(buildingId));
            this.drawItemName(buildingId, rect.x, rect.y, rect.width - numberWidth);    //should change this
            this.drawItemNumber(buildingId, rect.x, rect.y, rect.width);
            this.changePaintOpacity(1);
        }
        //console.log(this._data);
    };

    Window_SimGameBuildingList.prototype.numberWidth = function() {
        return this.textWidth('000');
    };

    Window_SimGameBuildingList.prototype.drawItemName = function(id, x, y, width) {
        //override the drawItemName function of Window_Base
        width = width || 312;
        if (id !== undefined) {
            var iconBoxWidth = Window_Base._iconWidth + 4;
            this.resetTextColor();
            //this.drawIcon(item.iconIndex, x + 2, y + 2);
            //deal with this display later
            //this.drawCharacter(SimGamePlugin.Params.buildings[id]["imageName"], SimGamePlugin.Params.buildings[id]["imageOffset"], x, y);
            this.drawText(SimGamePlugin.Params.buildings[id]["name"], x + iconBoxWidth, y, width - iconBoxWidth);
            //console.log(SimGamePlugin.Params.buildings[id]["name"]);
        }
    };

    Window_SimGameBuildingList.prototype.drawItemNumber = function(id, x, y, width) {
        //draw ∞ for infinite buildings, current number for current buildings
        if (this.needsNumber()) {
            this.drawText(':', x, y, width - this.textWidth('00'), 'right');
            if(SimGamePlugin.Params.buildings[id]["isInfinite"] === "true"){
                this.drawText("∞",x,y,width,"right");
            }
            else{
                var curBuilding = SimGamePlugin.SimGame.numFinite.find((value) => {
                    return value.buildingId === id;
                })
                if(curBuilding){
                    this.drawText(curBuilding.amount,x,y,width,"right");
                }
                else{
                    this.drawText("0",x,y,width,right);
                }
            }
        }
    };

    Window_SimGameBuildingList.prototype.updateHelp = function() {
        this.setHelpWindowItem(this.item());
    };

    Window_SimGameBuildingList.prototype.refresh = function() {
        this.makeItemList();
        this.createContents();
        this.drawAllItems();
    };

    //The window that deals with the construct building selection.
    function Window_SimGameBuildingSelection() {
        this.initialize.apply(this, arguments);
    }

    Window_SimGameBuildingSelection.prototype = Object.create(Window_SimGameBuildingList.prototype);
    Window_SimGameBuildingSelection.prototype.constructor = Window_SimGameBuildingSelection;

    Window_SimGameBuildingSelection.prototype.initialize = function(/*messageWindow*/) {
        //this._messageWindow = messageWindow;
        var width = Graphics.boxWidth;
        var height = this.windowHeight();
        Window_SimGameBuildingList.prototype.initialize.call(this, 0, 0, width, height);
        this.openness = 0;
        this.deactivate();
        //this.setHandler('ok',     this.onOk.bind(this));
        //this.setHandler('cancel', this.onCancel.bind(this));
    };

    Window_SimGameBuildingSelection.prototype.windowHeight = function() {
        return this.fittingHeight(this.numVisibleRows());
    };

    Window_SimGameBuildingSelection.prototype.numVisibleRows = function() {
        return 4;
    };

    Window_SimGameBuildingSelection.prototype.start = function() {
        this.refresh();
        this.updatePlacement();
        this.select(0);
        this.open();
        this.activate();
    };

    Window_SimGameBuildingSelection.prototype.updatePlacement = function() {
        //if (this._messageWindow.y >= Graphics.boxHeight / 2) {
            this.y = 0;
        //} else {
        //    this.y = Graphics.boxHeight - this.height;
        //}
    };

    //This creates the scene of the building selection
    function Scene_BuildingSelection() {
        this.initialize.apply(this, arguments);
    }

    Scene_BuildingSelection.prototype = Object.create(Scene_MenuBase.prototype);
    Scene_BuildingSelection.prototype.constructor = Scene_BuildingSelection;

    Scene_BuildingSelection.prototype.initialize = function() {
        Scene_MenuBase.prototype.initialize.call(this);
    };

    Scene_BuildingSelection.prototype.create = function() {
        Scene_MenuBase.prototype.create.call(this);
        this.createSelectionWindow();
    };

    Scene_BuildingSelection.prototype.createSelectionWindow = function() {
        this._selectionWindow = new Window_SimGameBuildingSelection();
        this._selectionWindow.setHandler('ok', this.onOk.bind(this));
        this._selectionWindow.setHandler('cancel', this.onCancel.bind(this));
        this.addWindow(this._selectionWindow);
        this._selectionWindow.start();
    };

    Scene_BuildingSelection.prototype.onOk = function() {
        //displays the information of the building; ask the player if he/she would like to construct it.
        //this.close();
        var id = this._selectionWindow.item();
        $gameMessage.add(SimGamePlugin.Params.buildings[id]["name"]);
        $gameMessage.add(JSON.parse(SimGamePlugin.Params.buildings[id]["description"]));
        $gameMessage.add("Profits per hour: " + SimGamePlugin.Params.buildings[id]["profit"]);
        $gameMessage.add("Building cost: " + SimGamePlugin.Params.buildings[id]["cost"] + ", you now have " + $gameParty.gold());
        if($gameParty.gold() >= SimGamePlugin.Params.buildings[id]["cost"]){
            //having enough money to build
            $gameParty.loseGold(SimGamePlugin.Params.buildings[id]["cost"]);
            if(SimGamePlugin.Params.buildings[id]["isInfinite"] === "false"){
                //change the amount if the building is finite
                SimGamePlugin.SimGame.consumeFiniteBuilding(id,1);
            }
            SimGamePlugin.SimGame.constructBuilding($gameMap.mapId(),$gameMap.eventIdXy($gamePlayer.x,$gamePlayer.y),id);
            $gameMessage.add("Successfully constructed.");
            //try add the choice if time permits...
            /*$gameMessage.add("Would you like to construct it here?");
            $gameMessage.setChoices(["Yes","No"],0,1);
            console.log("after setchoice");
            $gameMessage.setChoiceCallback((n) => {
                if(n === 0){
                    //"yes" selected
                    $gameParty.loseGold(SimGamePlugin.Params.buildings[id]["cost"]);
                    SimGamePlugin.SimGame.constructBuilding($gameMap.mapId(),$gameMap.eventIdXy($gamePlayer.x,$gamePlayer.y),id);
                    //terminate the select window
                    //this._messageWindow.terminateMessage();
                    
                }
                
            });*/
            SimGamePlugin.SimGame.inOtherScene = false;
            this.popScene();
            
        }
        else{
            //not enough money; nothing happens
            $gameMessage.add("You don't have enough money to build it.");
            SimGamePlugin.SimGame.inOtherScene = false;
            this.popScene();
        }
    };

    Scene_BuildingSelection.prototype.onCancel = function() {
        //this._messageWindow.terminateMessage();
        SimGamePlugin.SimGame.inOtherScene = false;
        this.popScene();
    };

    //Window of building buying, inheriting from Window_ShopBuy class
    function Window_BuildingBuy(){
        this.initialize.apply(this, arguments);
    }

    Window_BuildingBuy.prototype = Object.create(Window_ShopBuy.prototype);
    Window_BuildingBuy.prototype.constructor = Window_BuildingBuy;

    Window_BuildingBuy.prototype.initialize = function(x, y, height) {
        Window_ShopBuy.prototype.initialize.call(this,x,y,height,[]);
    }

    Window_BuildingBuy.prototype.isEnabled = function(item) {
        //the item is disabled only if no enough money
        return (item && this.price(item) <= this._money);
    };

    Window_BuildingBuy.prototype.makeItemList = function() {
        //_data: {buildingId,curAmount}
        //_price: (shopCost of the buildingId)
        //_shopGoods: just all the buildings
        this._data = [];
        this._price = [];
        SimGamePlugin.Params.buildings.forEach((building,id) => {
            //add to the data list if the building is:
            //able to be shopped in this tier (tier >= minShopTier), and
            //it is finite, or it is infinite and locked
            if(SimGamePlugin.SimGame.tier >= building["minShopTier"]){
                if(building["isInfinite"] === "false"){
                    //finite
                    var curAmount = SimGamePlugin.SimGame.numFinite.find((value) => value.buildingId === id);
                    if(curAmount){
                        this._data.push({
                            buildingId: id,
                            curAmount: curAmount.amount
                        });
                        this._price.push(Number(building["shopCost"]));
                    }
                    else{
                        this._data.push({
                            buildingId: id,
                            curAmount: 0
                        });
                        this._price.push(Number(building["shopCost"]));
                    }
                }
                else{
                    //infinite
                    if(!SimGamePlugin.SimGame.unlocks.includes(id)){
                        //locked
                        this._data.push({
                            buildingId: id,
                            curAmount: 0
                        });
                        this._price.push(Number(building["shopCost"]));
                    }
                }
            }
        });
    };

    Window_BuildingBuy.prototype.drawItemName = function(item, x, y, width) {
        width = width || 312;
        if (item !== undefined) {
            var iconBoxWidth = Window_Base._iconWidth + 4;
            this.resetTextColor();
            this.drawText(SimGamePlugin.Params.buildings[item.buildingId]["name"], x + iconBoxWidth, y, width - iconBoxWidth);
        }
    };

    //Number window of building shop; Window_ShopNumber
    function Window_BuildingNumber() {
        this.initialize.apply(this, arguments);
    }
    
    Window_BuildingNumber.prototype = Object.create(Window_ShopNumber.prototype);
    Window_BuildingNumber.prototype.constructor = Window_BuildingNumber;
    
    Window_BuildingNumber.prototype.initialize = function(x, y, height) {
        Window_ShopNumber.prototype.initialize.call(this, x, y, height);
    };

    Window_BuildingNumber.prototype.drawItemName = function(item, x, y, width) {
        width = width || 312;
        if (item !== undefined) {
            var iconBoxWidth = Window_Base._iconWidth + 4;
            this.resetTextColor();
            this.drawText(SimGamePlugin.Params.buildings[item.buildingId]["name"], x + iconBoxWidth, y, width - iconBoxWidth);
        }
    };

    //Status window of building shop; Window_ShopStatus
    function Window_BuildingStatus() {
        this.initialize.apply(this, arguments);
    }
    
    Window_BuildingStatus.prototype = Object.create(Window_ShopStatus.prototype);
    Window_BuildingStatus.prototype.constructor = Window_BuildingStatus;
    
    Window_BuildingStatus.prototype.initialize = function(x, y, width, height) {
        Window_ShopStatus.prototype.initialize.call(this, x, y, width, height);
        //this._item = null;
        //this._pageIndex = 0;
        //this.refresh();
    };

    Window_BuildingStatus.prototype.isEquipItem = function() {
        //it is not
        return false;
    };

    Window_BuildingStatus.prototype.drawPossession = function(x, y) {
        var width = this.contents.width - this.textPadding() - x;
        var possessionWidth = this.textWidth('0000');
        this.changeTextColor(this.systemColor());
        this.drawText(TextManager.possession, x, y, width - possessionWidth);
        this.resetTextColor();
        this.drawText(this._item.curAmount, x, y, width, 'right');
    };

    //Help window of building ship; Window_Help
    function Window_BuildingHelp() {
        this.initialize.apply(this, arguments);
    }
    
    Window_BuildingHelp.prototype = Object.create(Window_Help.prototype);
    Window_BuildingHelp.prototype.constructor = Window_BuildingHelp;
    
    Window_BuildingHelp.prototype.initialize = function(numLines) {
        Window_Help.prototype.initialize.call(this);
        //this._text = '';
    };

    Window_BuildingHelp.prototype.setItem = function(item) {
        this.setText(item ? JSON.parse(SimGamePlugin.Params.buildings[item.buildingId]["description"]) : '');
    };

    //This is the scene of the buildings shop
    //It inherits from the Scene_Shop class
    function Scene_BuildingShop() {
        this.initialize.apply(this, arguments);
    }
    
    Scene_BuildingShop.prototype = Object.create(Scene_Shop.prototype);
    Scene_BuildingShop.prototype.constructor = Scene_BuildingShop;
    
    Scene_BuildingShop.prototype.initialize = function() {
        Scene_Shop.prototype.initialize.call(this);
    };
    
    Scene_BuildingShop.prototype.prepare = function() {
        //probably add the goods here
        this._purchaseOnly = true;
        this._item = null;
    };
    
    Scene_BuildingShop.prototype.create = function() {
        Scene_Shop.prototype.create.call(this);
    };

    Scene_BuildingShop.prototype.createHelpWindow = function() {
        this._helpWindow = new Window_BuildingHelp();
        this.addWindow(this._helpWindow);
    };
    
    Scene_BuildingShop.prototype.createNumberWindow = function() {
        var wy = this._dummyWindow.y;
        var wh = this._dummyWindow.height;
        this._numberWindow = new Window_BuildingNumber(0, wy, wh);
        this._numberWindow.hide();
        this._numberWindow.setHandler('ok',     this.onNumberOk.bind(this));
        this._numberWindow.setHandler('cancel', this.onNumberCancel.bind(this));
        this.addWindow(this._numberWindow);
    };
    
    Scene_BuildingShop.prototype.createStatusWindow = function() {
        var wx = this._numberWindow.width;
        var wy = this._dummyWindow.y;
        var ww = Graphics.boxWidth - wx;
        var wh = this._dummyWindow.height;
        this._statusWindow = new Window_BuildingStatus(wx, wy, ww, wh);
        this._statusWindow.hide();
        this.addWindow(this._statusWindow);
    };
    
    Scene_BuildingShop.prototype.createBuyWindow = function() {
        var wy = this._dummyWindow.y;
        var wh = this._dummyWindow.height;
        this._buyWindow = new Window_BuildingBuy(0, wy, wh);
        this._buyWindow.setHelpWindow(this._helpWindow);
        this._buyWindow.setStatusWindow(this._statusWindow);
        this._buyWindow.hide();
        this._buyWindow.setHandler('ok',     this.onBuyOk.bind(this));
        this._buyWindow.setHandler('cancel', this.onBuyCancel.bind(this));
        this.addWindow(this._buyWindow);
    };
    
    Scene_BuildingShop.prototype.doBuy = function(number) {
        //need to change the operation here
        //this._item.buildingId
        //infinite -> unlock
        //finite, locked -> unlock, increase by *number*
        //finite, unlocked -> increase by *number*
        $gameParty.loseGold(number * this.buyingPrice());
        if(SimGamePlugin.Params.buildings[this._item.buildingId]["isInfinite"] === "true"){
            //unlock
            SimGamePlugin.SimGame.unlockBuilding(this._item.buildingId);
        }
        else{
            if(SimGamePlugin.SimGame.unlocks.includes(this._item.buildingId)){
                //increase number
                SimGamePlugin.SimGame.getFiniteBuilding(this._item.buildingId, number);
            }
            else{
                //unlock and increase number
                SimGamePlugin.SimGame.unlockBuilding(this._item.buildingId);
                SimGamePlugin.SimGame.getFiniteBuilding(this._item.buildingId, number);
            }
        }
    };
    
    Scene_BuildingShop.prototype.maxBuy = function() {
        //need to modify this
        //if infinite, can only buy one
        //if finite, can buy up to maxItems (need checking)
        if(SimGamePlugin.Params.buildings[this._item.buildingId]["isInfinite"] === "true"){
            //can only buy one
            return 1;
        }
        else{
            //can buy up to maxItems
            var max = 99 - this._item.curAmount;
            var price = this.buyingPrice();
            if (price > 0) {
                return Math.min(max, Math.floor(this.money() / price));
            } else {
                return max;
            }
        }
    };
})();
