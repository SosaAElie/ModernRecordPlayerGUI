"use strict";
const Mfrc522 = require("mfrc522-rpi");
const SoftSPI = require("rpi-softspi");
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require("path")
const pg = require("pg")
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

	const client = new pg.Client({
		host: "localhost",
		port: 5432,
		database: "storage",
		user: "easosa",
	})
	client.connect()

	const mainWindow = new BrowserWindow({
		width: 800,
		height: 600,
		webPreferences: {
			contextIsolation: true,
			preload: path.join(__dirname, 'preload.js'),
		},
	});
	
	mainWindow.loadFile("./Pages/artists.html");
	// mainWindow.webContents.openDevTools()
	let intervalId;
	ipcMain.handle("search:artist", (event, args)=>SpotifyWrapper.getSpotifyArtist(event, args, mainWindow))
	ipcMain.handle("search:album", (event, args) => SpotifyWrapper.getArtistAlbums(event, args, mainWindow))
	ipcMain.handle("scan", (event, args) => {
		intervalId = scan(event, args, mainWindow, mfrc522)
		console.log(intervalId)
	})
	ipcMain.handle("cancel:scan", ()=>{
		console.log("Cancelling scan");
		console.log(intervalId);
		clearInterval(intervalId);
	})
	ipcMain.handle("album:tracks", (event, args)=> SpotifyWrapper.getAlbumTracks(event, args, mainWindow))
}

function scan(event, args, mainWindow, mfrc522) {
	let uid;
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
	const intervalId = setInterval(scanningFunction, 500, event, args, mainWindow, scannerPopUp, mfrc522)
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


	function scanningFunction(event, args, mainWindow, scannerPopUp, mfrc522) {
		console.log("Scanning")
		mfrc522.reset();
		const chip = mfrc522.findCard();
		if(chip.status){
			clearInterval(intervalId);
			mainWindow.webContents.send(true);
			scannerPopUp.close();
			uid = uidToNum(chip.getUid().data)
			isRfidUriPresent(client, uid)
				.then(rows =>{
					
					if (rows.length < 1) addRfidUri(client, uid, args)
					else updateRfidUri(client, uid, args)
				})
		}

		
	}
	return intervalId;
}

//Functions used to interact with the postgreSQL database

function isRfidUriPresent(client, id) {
	return client.query(`SELECT id FROM rfiduri WHERE id = '${id}'`)
		.then(res => res.rows)
}

function addRfidUri(client, id, uri) {
	//Adds an entry for the rfid if there is no entry present
	console.log("rfid of chip is not within table, adding it along with the desired spotify album uri")
	client.query(`INSERT INTO rfiduri VALUES ('${id.toString()}', '${uri}')`)
}

function updateRfidUri(client, id, uri) {
	//If there is an entry present in the sql database will overwrite the entry with the new spotify album uri
	console.log("Updating the associated spotify uri of the rfid chip")
	client.query(`UPDATE rfiduri SET id = '${id}', uri = '${uri}' WHERE id = '${id}'`)
}

function uidToNum(uid) {
	//Same uid 5 byte conversion as MFRC522 library for python
	let n = 0;
	for (let i = 0; i < 5; i++) {
		n = n * 256 + uid[i]
	}
	return n
}

//End of functions used to interact with the postgreSQL database

main()