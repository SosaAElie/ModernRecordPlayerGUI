"use strict";
//const Mfrc522 = require("mfrc522-rpi");
//const SoftSPI = require("rpi-softspi");
const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require("fs");
const path = require("path")
const fetch = require("node-fetch")
const pg = require("pg")

function main(){
	// const softSPI = new SoftSPI({
  	// 			clock: 23, // pin number of SCLK
  	// 			mosi: 19, // pin number of MOSI
  	// 			miso: 21, // pin number of MISO
  	// 			client: 24 // pin number of CS
	// 		});
	//const mfrc522 = new Mfrc522(softSPI).setResetPin(22)
	const client = new pg.Client({
		host:"localhost",
		port:5432,
		database:"storage",
		user:"easosa",
	})
	client.connect()
	app.whenReady().then(mainProcess);
}

function mainProcess(){
	
	const mainWindow = new BrowserWindow({
		width: 800,
    	height: 600,
		webPreferences: {
			contextIsolation: true,
      		preload: path.join(__dirname, 'preload.js')
    		},
	});

	
	mainWindow.loadFile("index.html");
	ipcMain.handle("search:artist",getSpotifyArtist)
	ipcMain.handle("search:album", (event, args)=>getArtistAlbums(event, args, mainWindow))
	ipcMain.handle("scan", (event, args) => scan(event, args, mainWindow))
}

function scan(event, args, mainWindow){
	let flag = false;
	let uid;
	let count = 0
	const scannerPopUp = new BrowserWindow({
		parent:mainWindow,
		modal:true,
		show:false,
		width:400,
		height:300,
		titleBarOverlay:true,
		webPreferences: {
			contextIsolation: true,
    		},
	})
	scannerPopUp.loadFile("popup.html")
	scannerPopUp.once("ready-to-show", ()=>scannerPopUp.show())
	const scanningInterval = setInterval( scanningFunction, 500)

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


	function scanningFunction(){
		console.log("Scanning")
		let flag = false
		for(let i = 0; i < 3; i++) if (i == 2) flag = true
		if(flag){
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


function isRfidUriPresent(client, id){	
	return client.query(`SELECT id FROM rfiduri WHERE id = '${id}'`)
			.then(res => res.rows)	
}

function addRfidUri(client, id, uri){
	//Adds an entry for the rfid if there is no entry present
	console.log("rfid of chip is not within table, adding it along with the desired spotify album uri")
	client.query(`INSERT INTO rfiduri VALUES ('${id.toString()}', '${uri}')`)
}

function updateRfidUri(client, id, uri){
	//If there is an entry present in the sql database will overwrite the entry with the new spotify album uri
	console.log("Updating the associated spotify uri of the rfid chip")
	client.query(`UPDATE rfiduri SET id = '${id}', uri = '${uri}' WHERE id = '${id}'`)
}

function uidToNum(uid){
	//Same uid 5 byte conversion as MFRC522 library for python
	let n = 0;
	for(let i = 0; i < 5; i++){
		n = n * 256 + uid[i]
	}
	return n
}

function getSpotifyArtist(event, artistName){
	//Takes in the name of the spotify artist and returns an object with the artist name being the property and a list containing the ID and the img URI as the value
	//console.log(artistName)
	const endpoint = new URL("https://api.spotify.com/v1/search");
	const headers = {
		"Authorization":`Bearer ${getToken()}`,
	}
	
	endpoint.searchParams.append("q",artistName);
	endpoint.searchParams.append("type",["artist"]);
	const requestType = {
		method:"GET",
		headers:headers,
	};
	
	return fetch(endpoint, requestType)
		.then(response => response.json())
		.then(data => { 
			const artists = {}
			let counter = 0
			for(let item of data.artists.items){
				try{
					artists[counter++] = [item.name, item.id, item["images"][0]["url"]]
				} catch (TypeError){
					//console.log(item)
					artists[counter++] = [item.name, item.id, "defaultArtistImage.png"]
				}	
				}
			return(artists)
			})



}

function getArtistAlbums(event, id, mainWindow){
	mainWindow.loadFile("albums.html")
	console.log(id)
	const endpoint = new URL(`https://api.spotify.com/v1/artists/${id}/albums`)

	const headers = {
		"Authorization":`Bearer ${getToken()}`,
	};
	endpoint.searchParams.append("include_groups","album");
	const requestType = {
		method:"GET",
		headers:headers,
	};
	
	fetch(endpoint, requestType)
		.then(response => response.json())
		.then(data => { 
			const albums = {}
			let counter = 0
			for(let item of data.items){
				try{
					albums[counter++] = [item.uri, item["images"][0]["url"]]
				}catch(TypeError){
					albums[counter++] = [item.uri, "No Image"]
				}
			}
			mainWindow.webContents.send("albums:data",albums)
			mainWindow.webContents.openDevTools()
			})
}

function getNewToken(){

	const endpoint = new URL("https://accounts.spotify.com/api/token");
	const headers = {
		"Content-Type":"application/x-www-form-urlencoded",
	};
	endpoint.searchParams.append("grant_type","client_credentials");
	endpoint.searchParams.append("client_id","5f9308fd6c4a4848b4d8850ef398b176");
	endpoint.searchParams.append("client_secret","cbabac7e271943a188688e6d3d266dd4");
	
	const requestType = {
		method:"POST",
		headers:headers,
	};
	
	fetch(endpoint, requestType)
		.then(response => response.json())
		.then(data => { 
			console.log("Got a new token")
			storeToken([data["access_token"], (data["expires_in"]*1000)+Date.now(), data["token_type"]])
		})
	
}

function getToken(){
	//Will read a csv file containing the stored API token, the time it expires in and the refresh token to get a new access token when it expires
	let [accessToken, expirationTime, tokenType] = fs.readFileSync("apitoken.csv").toString().split(",");
	if (Date.now() >= parseInt(expirationTime)){
		console.log("Getting a new token")
		getNewToken()
		[accessToken, expirationTime, tokenType] = fs.readFileSync("apitoken.csv").toString().split(",");
	}
	return accessToken
}

function storeToken(data){
	//Overwrites an existing file or creates a new one if none exists and stores the access token, the expiration time and the refresh token
	console.log("Token stored")
	fs.writeFileSync("apitoken.csv", data.join());
}

main()



