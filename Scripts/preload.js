const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld("electronAPI", {
	sendArtist:artistName=>ipcRenderer.invoke("search:artist", artistName),
	sendArtistID:id=>ipcRenderer.invoke("search:album", id),
	getAlbumTracks:cb=>ipcRenderer.invoke("album:tracks", cb),
	scan:spotifyURI=>ipcRenderer.invoke("scan", spotifyURI),
	handleAlbums:cb=>ipcRenderer.on('albums:data', cb),
	handleArtists:cb=>ipcRenderer.on("artists:data", cb),
})
