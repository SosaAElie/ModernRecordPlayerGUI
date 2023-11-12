const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld("electronAPI", {
	sendArtist:artistName=>ipcRenderer.invoke("search:artist", artistName),
	sendArtistID:artistId=>ipcRenderer.invoke("search:album", artistId),
	getAlbumTracks:albumId=>ipcRenderer.invoke("album:tracks", albumId),
	startScan:spotifyURI=>ipcRenderer.invoke("scan", spotifyURI),
	handleAlbums:cb=>ipcRenderer.on('albums:data', cb),
	handleArtists:cb=>ipcRenderer.on("artists:data", cb),
	handleScan:cb=>ipcRenderer.on("handle:scan",cb),
})
