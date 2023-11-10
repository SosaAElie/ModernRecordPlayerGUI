"use strict";
//const Mfrc522 = require("mfrc522-rpi");
//const SoftSPI = require("rpi-softspi");
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require("path")
const fetch = require("node-fetch")
const pg = require("pg")
const {SpotifyWrapper} = require("./SpotifyModule")


function main() {
	// const softSPI = new SoftSPI({
	// 			clock: 23, // pin number of SCLK
	// 			mosi: 19, // pin number of MOSI
	// 			miso: 21, // pin number of MISO
	// 			client: 24 // pin number of CS
	// 		});
	//const mfrc522 = new Mfrc522(softSPI).setResetPin(22)
	const client = new pg.Client({
		host: "localhost",
		port: 5432,
		database: "storage",
		user: "easosa",
	})
	client.connect()
	app.whenReady().then(mainProcess);
}

function mainProcess() {

	const mainWindow = new BrowserWindow({
		width: 800,
		height: 600,
		webPreferences: {
			contextIsolation: true,
			preload: path.join(__dirname, 'preload.js')
		},
	});
	
	mainWindow.loadFile("index.html");
	ipcMain.handle("search:artist", (event, args)=>SpotifyWrapper.getSpotifyArtist(event, args, mainWindow))
	ipcMain.handle("search:album", (event, args) => SpotifyWrapper.getArtistAlbums(event, args, mainWindow))
	ipcMain.handle("scan", (event, args) => scan(event, args, mainWindow))
}

function scan(event, args, mainWindow) {
	let flag = false;
	let uid;
	let count = 0
	const scannerPopUp = new BrowserWindow({
		parent: mainWindow,
		modal: true,
		show: false,
		width: 400,
		height: 300,
		titleBarOverlay: true,
		webPreferences: {
			contextIsolation: true,
		},
	})
	scannerPopUp.loadFile("popup.html")
	scannerPopUp.once("ready-to-show", () => scannerPopUp.show())
	const scanningInterval = setInterval(scanningFunction, 500)

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


	function scanningFunction() {
		console.log("Scanning")
		let flag = false
		for (let i = 0; i < 3; i++) if (i == 2) flag = true
		if (flag) {
			console.log("Canceling Scanner")
			clearInterval(scanningInterval)
			console.log("intervalled function cancelled")
			scannerPopUp.close()
		}
	}

	// while(!flag && count != 1000){
	// 	//mfrc522.reset()
	// 	count++;
	// 	//let mfrc522O = mfrc522.findCard();
	// 	//flag = mfrc522O.status;
	// 	if (flag){
	// 		//uid = uidToNum(mfrc522.getUid().data)
	// 		isRfidUriPresent(client, uid)
	// 			.then(rows =>{
	// 				console.log(rows.length)
	// 				if (rows.length < 1) addRfidUri(client, uid, args)
	// 				else updateRfidUri(client, uid, args)
	// 			})
	// 	}
	// }
	// if (count == 1000) console.log("timed out")
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