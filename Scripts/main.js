"use strict";
const Mfrc522 = require("mfrc522-rpi");
const SoftSPI = require("rpi-softspi");
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require("path")
const {SpotifyWrapper} = require("../Scripts/SpotifyModule");
const { clearInterval } = require("timers");

function main() {

	app.whenReady().then(mainProcess);
}

function mainProcess() {
	const softSPI = new SoftSPI({
		clock: 23, // pin number of SCLK
		mosi: 19, // pin number of MOSI
		miso: 21, // pin number of MISO
		client: 24 // pin number of CS
	});
	const mfrc522 = new Mfrc522(softSPI).setResetPin(22)

	const mainWindow = new BrowserWindow({
		width: 800,
		height: 600,
		webPreferences: {
			contextIsolation: true,
			preload: path.join(__dirname, 'preload.js'),
		},
	});
	
	mainWindow.loadFile("./Pages/homepage.html");
	// mainWindow.webContents.openDevTools()
	let intervalId;
	ipcMain.handle("search:artist", (event, args)=>SpotifyWrapper.getArtist(event, args, mainWindow))
	ipcMain.handle("search:album", (event, args) => SpotifyWrapper.getArtistAlbums(event, args, mainWindow))
	ipcMain.handle("search:devices", SpotifyWrapper.getAvailableDevices)
	ipcMain.handle("scan", (event, args) => {
		//intervalId = scan(event, args, mainWindow, null, null)
		intervalId = scan(event, args, mainWindow, mfrc522, client)
	})
	ipcMain.handle("cancel:scan", ()=>{
		console.log("Cancelling scan");
		clearInterval(intervalId);
	})
	ipcMain.handle("album:tracks", (event, args)=> SpotifyWrapper.getAlbumTracks(event, args, mainWindow))
}

function scan(event, args, mainWindow, mfrc522, client) {
	const scannerPopUp = new BrowserWindow({
		parent: mainWindow,
		modal: true,
		show: false,
		width: 400,
		height: 300,
		titleBarOverlay: true,
		webPreferences: {
			contextIsolation: true,
			preload: path.join(__dirname, 'preload.js'),
		},
	})
	scannerPopUp.loadFile("./Pages/popup.html");
	scannerPopUp.once("ready-to-show", ()=>scannerPopUp.show());
	const intervalId = setInterval(scanningFunction, 500, event, args, mainWindow, scannerPopUp, mfrc522, client)
	/*
		Problem: 
			How do I cancel the intervalled function when the user has scanned their RFID chip?

		My Solution:
			Create a function, not a callback function, within the same scope as the setInterval function call,
			get the intervalID that is returned by the setInterval function and
			access it within the function body of the soon to be intervalled function.

			Scan for rfid chips and create a conditional statement that when one is found,
			the clearInterval function is called accessing the intervalID of the setInterval function
			defined in the outer scope.
	*/


	function scanningFunction(event, args, mainWindow, scannerPopUp, mfrc522, client) {
		mfrc522.reset();
		
		const chip = mfrc522.findCard();
		if(!chip.status) return;
		
		console.log("scanned chip")
		clearInterval(intervalId);
		let uidObject = mfrc522.getUid();
		let uid = uidObject.data;
		if(!uidObject.status){
			console.log("Error getting the ID of the rfid chip");
			return;
		}
		mfrc522.selectCard(uid); //Returns memory capacity as a number
		const storedAlbumUri = readRfidChip(uid, mfrc522);
		if(args.hasOwnProperty("rfid")){
			if(storedAlbumUri) console.log("Overwriting the stored album");
			else console.log("Writing album to clean rfid chip")
			let albumUri = args.rfid[0];
			writeToRfidChip(albumUri, uidObject.data, mfrc522);
			scannerPopUp.webContents.send("handle:scan", true)
		}
		else if (args.hasOwnProperty("play")){
			if(!storedAlbumUri){
				console.log("No album stored in the rfid chip");
				scannerPopUp.webContents.send("handle:scan", false);
				return;
			}
			const deviceId = args.play[1];
			SpotifyWrapper.startPlayback(deviceId, storedAlbumUri);
			scannerPopUp.webContents.send("handle:scan", true)
		}

	}
	return intervalId;
}

//Functions used to write spotify album uri to rfid chip

function writeToRfidChip(str, uid, mfrc522){
	const charBuffers = strToAsciiArrays(str, 16);//Each sector can hold 16 hex values
	const KEY = [0xff, 0xff, 0xff, 0xff, 0xff, 0xff];//Standard key to access read/write sectors on rfid chip
	const startBlock = 8;//Start writing at sector 8 according to the mfrc522-rpi nodejs library
	const writtenData = [];
	for(let sector = startBlock; sector < sector+charBuffers.length; sector++){ 
		if (!mfrc522.authenticate(sector, KEY, uid)) {
			console.log("RFID Chip Authentication Error");
			return;
		} 
	  	let charBuffer = charBuffers[sector-startBlock];
		console.log(`Block ${sector} will be overwritten.`);
		mfrc522.writeDataToBlock(sector, charBuffer);
	  	let storedData = mfrc522.getDataForBlock(sector);
		storedData.forEach(c=>c!=0?writtenData.push(c):c); //If the hexadecimal value in the array is 0, then it is pressumed to be the default stored value
		//const oldBlock8Data = mfrc522.getDataForBlock(sector);
		//console.log("Old data: " + oldBlock8Data);
		//console.log(`Now Block ${i} looks like this:`,newBlock8Data);
	}
	let writtenStr = String.fromCharCode(...writtenData);
	mfrc522.stopCrypto();
	
	if(str == writtenStr) console.log("The string was successfully written.")
	else console.log("Error the str written to rfid chip is not the same as the str passed in.");
	 
}

function readRfidChip(uid, mfrc522, start = 8, sectorsToRead = 3){
	//Starts reading from sector 8 and uses utf-8 encoding to produce the string stored the number of sectors specified
	const KEY = [0xff, 0xff, 0xff, 0xff, 0xff, 0xff];//Standard key to access read/write sectors on rfid chip
	const storedData = [];
	for(let sector = start; sector<start+sectorsToRead; sector++){ 
		if (!mfrc522.authenticate(sector, KEY, uid)) {
			console.log("RFID Chip Authentication Error");
			return;
		}
		let blockData = mfrc522.getDataForBlock(sector);
		blockData.forEach(c=>c!=0?storedData.push(c):c);//If the hexadecimal value in the array is 0, then it is pressumed to be the default stored value
	}
	//mfrc522.stopCrypto(); Using this method prevents further accessing of sectors on this card unless the card is selected again
	if (!storedData.length) return ""
	return String.fromCharCode(...storedData);
}
  
function strToAsciiArrays(str, arraySize){
	const charBuffer = [];
	const charBuffers = [];
	for(let i = 0; i < str.length; i++){
	  if(charBuffer.length === arraySize){
		charBuffers.push(charBuffer.map(c=>c))
		charBuffer.length = 0;
	  }
	  charBuffer.push(str.charCodeAt(i));
	};
	if(charBuffer.length !== 0) charBuffers.push(charBuffer.map(c=>c)); 
	return charBuffers;
}
  



main()