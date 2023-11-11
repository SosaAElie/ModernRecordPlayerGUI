const fetch = require("node-fetch");
const fs = require("fs");
const { webContents } = require("electron");
const dotenv = require("dotenv").config()

const SpotifyWrapper = {

    getSpotifyArtist(event, artistName, mainWindow) {
        //Takes in the name of the spotify artist and returns an object with the artist name being the property and a list containing the ID and the img URI as the value
        const currentWindowTitle = mainWindow.getTitle();


        const endpoint = new URL("https://api.spotify.com/v1/search");
        const headers = {
            "Authorization": `Bearer ${tokenStorage.getToken()}`,
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
            "Authorization": `Bearer ${tokenStorage.getToken()}`,
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
                for (let item of data.items) {

                    try {
                        albums[counter++] = [item.uri, item["images"][0]["url"], item.id]
                    } catch (TypeError) {
                        albums[counter++] = [item.uri, "No Album Image", item.id]
                    }
                }
                mainWindow.webContents.send("albums:data", albums);
            })
    },

    getAlbumTracks(event, id, mainWindow) {
        const endpoint = new URL(`https://api.spotify.com/v1/albums/${id}/tracks`);
        const headers = {
            "Authorization": `Bearer ${tokenStorage.getToken()}`,
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
    msToMin(milliseconds) {
        const msToSec = milliseconds / 1000;
        const minutes = parseInt(((msToSec) / 60).toString());
        const seconds = parseInt((msToSec % 60).toString());
        return `${minutes}:${seconds}`;
    }
};


const tokenStorage = {
    cachedToken: {},
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

    getToken() {
        //Will read a csv file containing the stored API token, the time it expires in and the refresh token to get a new access token when it expires
        let accessToken;
        let expirationTime;
        let tokenType;

        if (this.cachedToken.hasOwnProperty("accessToken")) {
            console.log("Accessing runtime cache")
            accessToken = this.cachedToken.accessToken;
            expirationTime = this.cachedToken.expirationTime;
        }
        else {
            console.log("Reading token data from file");
            [accessToken, expirationTime, tokenType] = fs.readFileSync("apitoken.csv").toString().split(",");
            this.cachedToken.accessToken = accessToken;
            this.cachedToken.expirationTime = expirationTime;
        }

        if (Date.now() >= parseInt(expirationTime)) {
            console.log("Getting a new token")
            this.getNewToken().then(tokenData => {
                
                this.cachedToken.accessToken = tokenData[0];
                this.cachedToken.expirationTime = tokenData[1];
            })
            // [accessToken, expirationTime, tokenType] = fs.readFileSync("apitoken.csv").toString().split(",");
            // this.cachedToken.accessToken = accessToken;
            // this.cachedToken.expirationTime = expirationTime;    
        }

        return accessToken
    },

    storeToken(data) {
        //Overwrites an existing file or creates a new one if none exists and stores the access token, the expiration time and the refresh token
        console.log("New token stored")
        fs.writeFileSync("apitoken.csv", data.join());
    },

}

module.exports = {
    SpotifyWrapper
}