const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld("electronAPI", {
	sendArtist:artistName=>ipcRenderer.invoke("search:artist", artistName),
	sendArtistID:id=>ipcRenderer.invoke("search:album", id),
	scan:spotifyURI=>ipcRenderer.invoke("scan", spotifyURI),
	handleAlbums:callback=>ipcRenderer.on('albums:data', callback)
})
