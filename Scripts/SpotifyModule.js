const fetch = require("node-fetch");
const fs = require("fs");
const { webContents } = require("electron");
const { encode } = require("querystring");
const dotenv = require("dotenv").config()

const SpotifyWrapper = {
    cachedAlbumTracks:{},

    getArtist(event, artistName, mainWindow) {
        //Takes in the name of the spotify artist and returns an object with the artist name being the property and a list containing the ID and the img URI as the value
        const currentWindowTitle = mainWindow.getTitle();


        const endpoint = new URL("https://api.spotify.com/v1/search");
        const headers = {
            "Authorization": `Bearer ${tokenStorage.getToken("accessToken")}`,
        }

        endpoint.searchParams.append("q", artistName);
        endpoint.searchParams.append("type", ["artist"]);
        const requestType = {
            method: "GET",
            headers: headers,
        };

        return fetch(endpoint, requestType)
            .then(response => response.json())
            .then(data => {
                const artists = {}
                let counter = 0;
                for (let item of data.artists.items) {
                    try {
                        artists[counter++] = [item.name, item.id, item["images"][0]["url"]]
                    } catch (TypeError) {
                        continue;
                        //console.log("This artist has no image and as a result will not be included in the results sent to the render: "+item.name)
                    }
                    //mainWindow.openDevTools();
                }

                if (currentWindowTitle == "Albums") {
                    //mainWindow.loadFile("./Pages/artists.html");
                    mainWindow.webContents.send("artists:data", artists);
                    


                }
                return artists
            })

    },

    getArtistAlbums(event, id, mainWindow) {

        const endpoint = new URL(`https://api.spotify.com/v1/artists/${id}/albums`)

        const headers = {
            "Authorization": `Bearer ${tokenStorage.getToken("accessToken")}`,
        };
        endpoint.searchParams.append("include_groups", "album");
        const requestType = {
            method: "GET",
            headers: headers,
        };

        fetch(endpoint, requestType)
            .then(response => response.json())
            .then(data => {
                const albums = {}
                let counter = 0
                if(Object.entries(this.cachedAlbumTracks) !== 0) this.cachedAlbumTracks = {};
                for (let item of data.items) {
                    const albumUri = item.uri;
                    const albumId = item.id;
                    let albumImage = "No Album Image";
                    try{
                        albumImage = item["images"][0]["url"];
                    }
                    catch(TypeError){
                        continue;
                    }
                    
                    albums[counter++] = [albumUri, albumImage, albumId]
                    
                    this.getAlbumTracks(null, albumId, null)
                        .then(tracks=> this.cachedAlbumTracks[albumId] = tracks);
                }
                mainWindow.webContents.send("albums:data", albums);
            })
    },

    getAlbumTracks(event, id, mainWindow) {
       
        if(this.cachedAlbumTracks.hasOwnProperty(id)){
            console.log("Accessing album cache")
            return this.cachedAlbumTracks[id]
        }

        const endpoint = new URL(`https://api.spotify.com/v1/albums/${id}/tracks`);
        const headers = {
            "Authorization": `Bearer ${tokenStorage.getToken("accessToken")}`,
        };
        endpoint.searchParams.append("limit", 25);
        const requestType = {
            method: "GET",
            headers: headers,
        };

        return fetch(endpoint, requestType)
            .then(res => res.json())
            .then(data => {
                const songs = {};
                let track = 0;
                for (let song of data.items) {
                    songs[++track] = [song.name, this.msToMin(song.duration_ms)]
                }
                return songs
            })
    },

    getAvailableDevices(){
        const endpoint = new URL ("https://api.spotify.com/v1/me/player/devices");
        const headers = {
            "Authorization": `Bearer ${tokenStorage.getToken("deviceToken")}`,
        };
        const requestType = {
            method: "GET",
            headers: headers,
          
        };
        return fetch(endpoint, requestType)
            .then(res => res.json())
            .then(data=>{
                const devices = {}
                for (let device of data["devices"]){
                    devices[device.name] = device.id;
                }
                return devices
            })
    },

    startPlayback(deviceId, uri){
        const endpoint = new URL("https://api.spotify.com/v1/me/player/play");
        endpoint.searchParams.append("device_id", deviceId);
        const headers = {
            "Authorization":`Bearer ${tokenStorage.getToken("deviceToken")}`,
            "Content-Type": "application/json",
        };
        const requestType = {
            method:"PUT",
            headers: headers,
            body:JSON.stringify({
                "context_uri":uri,
                "position_ms":0,
            })
        };
        fetch(endpoint, requestType)
            .then(res=>res.status === 204?console.log("Playing the desired Album"):console.log(`Error with playback: ${res.status}`))
        
    },


    msToMin(milliseconds) {
        const msToSec = milliseconds / 1000;
        const minutes = parseInt(((msToSec) / 60).toString());
        const seconds = parseInt((msToSec % 60).toString());
        return `${minutes}:${seconds}`;
    }
};


const tokenStorage = {
    cachedTokens: {},
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,

    getNewToken() {
        // Accesses the spotify API to get a new oAuthv2 token
        const endpoint = new URL("https://accounts.spotify.com/api/token");
        const headers = {
            "Content-Type": "application/x-www-form-urlencoded",
        };

        endpoint.searchParams.append("grant_type", "client_credentials");
        endpoint.searchParams.append("client_id", this.clientId);
        endpoint.searchParams.append("client_secret", this.clientSecret);

        const requestType = {
            method: "POST",
            headers: headers,
        };

        return fetch(endpoint, requestType)
            .then(response => response.json())
            .then(data => {
                console.log("Got a new token")
                const access_token = data["access_token"];
                const expiration_time = (data["expires_in"] * 1000) + Date.now();
                const token_type = data["token_type"];
                this.storeToken([access_token, expiration_time, token_type]);
                return [access_token, expiration_time, token_type]
            })

    },
    
    getNewDeviceToken(){
        // Requires prior authorization by the user of the account, an access token is then granted
	    // by providing the code returned and the callback URI used
        const endpoint = new URL("https://accounts.spotify.com/api/token");
        endpoint.searchParams.append({
            "grant_type":"authorization_code",
            "code":"",
            "redirect_uri":"http://localhost:8080",
        });
        const headers = {
            "Content-Type":"application/x-www-form-urlencoded",
		    "Authorization":`Basic ${btoa(`${this.clientId}:${this.clientSecret}`)}`
        };
        const requestType = {
            method:"POST",
            headers:headers,
        }
        fetch(endpoint, requestType)
            .then(res=>res.json())
            .then(data=>{
                const deviceToken = data["access_token"];
                const deviceTokenExpirationTime = data["expires_in"];
                const refreshToken = data["refresh_token"];

                this.storeToken([deviceToken,deviceTokenExpirationTime,refreshToken], "deviceToken");
                return [deviceToken,deviceTokenExpirationTime,refreshToken];

            })
    },

    refreshAccessToken(refreshToken){
        const endpoint = new URL("https://accounts.spotify.com/api/token");
        endpoint.searchParams.append("grant_type","refresh_token");
        endpoint.searchParams.append("refresh_token",refreshToken);
        const headers = {
            "Content-Type":"application/x-www-form-urlencoded",
		    "Authorization":`Basic ${btoa(`${this.clientId}:${this.clientSecret}`)}`,
        }
        const requestType = {
            method:"POST",
            headers:headers,
        }
        return fetch(endpoint, requestType)
            .then(res => res.json())
            .then(data =>{
                let deviceToken = data["access_token"];
                let deviceTokenExpirationTime = Date.now() + data["expires_in"]*1000;
                this.storeToken([deviceToken, deviceTokenExpirationTime,refreshToken], "deviceToken")
                
                return [deviceToken, deviceTokenExpirationTime]
            })
    },

    getToken(tokenType) {
        //Will read a csv file containing the stored API token, the time it expires in and the refresh token to get a new access token when it expires
        let accessToken;
        let expirationTime;
        let type;
        let refreshToken;

        if (this.cachedTokens.hasOwnProperty(tokenType)) {
            console.log("Accessing runtime cache")
            accessToken = this.cachedTokens[tokenType];
            if (tokenType == "deviceToken"){ 
                expirationTime = this.cachedTokens.deviceTokenExpirationTime;
                refreshToken = this.refreshToken;
            }
            else if(tokenType == "accessToken") expirationTime = this.cachedTokens.expirationTime;
        }
        else {
            console.log("Reading token data from file");
            if(tokenType == "deviceToken"){
                [accessToken, expirationTime, refreshToken] = fs.readFileSync("devicetoken.csv").toString().split(",");
                this.cachedTokens.deviceToken = accessToken;
                this.cachedTokens.deviceTokenExpirationTime = expirationTime;
                this.refreshToken = refreshToken;
            }
            else if(tokenType == "accessToken"){
                [accessToken, expirationTime, type] = fs.readFileSync("apitoken.csv").toString().split(",");
                this.cachedTokens.accessToken = accessToken;
                this.cachedTokens.expirationTime = expirationTime;
            }
            else{ 
                console.log("No token for the desired type")
            }
        }

        if (Date.now() >= parseInt(expirationTime)) {
            console.log("Getting a new token")
            if (tokenType == "accessToken"){
                this.getNewToken().then(tokenData => { 
                    this.cachedTokens.accessToken = tokenData[0];
                    this.cachedTokens.expirationTime = tokenData[1];
                })
            }
            else if (tokenType == "deviceToken"){
                this.refreshAccessToken(refreshToken).then(tokenData =>{
                    this.cachedTokens.deviceToken = tokenData[0];
                    this.cachedTokens.deviceTokenExpirationTime = tokenData[1];
                })
            }
        }

        return accessToken
    },

    storeToken(data, tokenType) {
        //Overwrites an existing file or creates a new one if none exists and stores the access token, the expiration time and the refresh token
        console.log("New token stored")
        if (tokenType == "accessToken") fs.writeFileSync("apitoken.csv", data.join())
        else if (tokenType == "deviceToken")fs.writeFileSync("devicetoken.csv", data.join());
    },

}

module.exports = {
    SpotifyWrapper
}

SpotifyWrapper.getAvailableDevices()
    .then(devices =>{
        console.log(devices)
        SpotifyWrapper.startPlayback(devices["iPad"], "spotify:album:5lJqux7orBlA1QzyiBGti1")
    })
