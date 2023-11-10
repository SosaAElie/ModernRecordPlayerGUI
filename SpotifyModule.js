const fetch = require("node-fetch");
const fs = require("fs");

const SpotifyWrapper = {

    getSpotifyArtist(event, artistName, mainWindow) {
        //Takes in the name of the spotify artist and returns an object with the artist name being the property and a list containing the ID and the img URI as the value
        const currentWindowTitle = mainWindow.getTitle();
        if (currentWindowTitle === "Albums") mainWindow.loadFile("index.html");

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
                let counter = 0
                for (let item of data.artists.items) {
                    try {
                        artists[counter++] = [item.name, item.id, item["images"][0]["url"]]
                    } catch (TypeError) {
                        //console.log(item)
                        artists[counter++] = [item.name, item.id, "defaultArtistImage.png"]
                    }
                    mainWindow.openDevTools();
                }
                if (currentWindowTitle === "albums") mainWindow.webContents.send("artists:data", artists);
                return artists
            })
    
    },
    
    getArtistAlbums(event, id, mainWindow) {
        mainWindow.loadFile("albums.html")
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
                        albums[counter++] = [item.uri, item["images"][0]["url"]]
                    } catch (TypeError) {
                        albums[counter++] = [item.uri, "No Image"]
                    }
                }
                mainWindow.webContents.send("albums:data", albums)
                mainWindow.webContents.openDevTools()
            })
    },
    
};

const tokenStorage = {
    cachedToken: {},
    clientId: "5f9308fd6c4a4848b4d8850ef398b176",
    clientSecret: "cbabac7e271943a188688e6d3d266dd4",


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

        if (this.cachedToken.hasOwnProperty("accessToken")){
            console.log("Accessing runtime cache")
            accessToken = this.cachedToken.accessToken;
            expirationTime = this.cachedToken.expirationTime;
        }
        else{
            console.log("Reading token data from file");
            [accessToken, expirationTime, tokenType] = fs.readFileSync("apitoken.csv").toString().split(",");
            this.cachedToken.accessToken = accessToken;
            this.cachedToken.expirationTime = expirationTime;
        }

        if (Date.now() >= parseInt(expirationTime)) {
            console.log("Getting a new token")
            this.getNewToken().then(tokenData=>{
                console.log(tokenData)
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