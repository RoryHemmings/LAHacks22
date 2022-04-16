const SpotifyWebApi = require('spotify-web-api-node')
const EventEmitter = require('events')
const math = require('mathjs')
const { column } = require('mathjs')
async function _getUserTracks(userAccessToken) {
    var spotifyApi = new SpotifyWebApi()
    spotifyApi.setAccessToken(userAccessToken)
    let data = await spotifyApi.getMe()
    let playlistsData = await spotifyApi.getUserPlaylists(data.body.id)
    var trackEmitter = new EventEmitter()

    var tracks = []
    trackEmitter.on('track', (vector) => {
        tracks.push(vector)
    })
    await Promise.all(
        playlistsData.body.items.map(async (playlist) => {
            let playlistInfo = await spotifyApi.getPlaylist(playlist.id)
            playlistInfo.body.tracks.items.forEach(track => trackEmitter.emit('track', track))
        })
    )
    return tracks
}

function _normalize(vector) {
    // normalizes vector with mean and standard deviation
    var mean = math.mean(vector)
    var std = math.std(vector)
    return vector.map(x => (x - mean) / std)
}

async function getUserSongList(userAccessToken) {
    // get user tracks[id, name, featrues {danceability, energy, key, loudness, mode, speechiness, acousticness, instrumentalness, liveness, valence, tempo, duration_ms, time_signature}]
    let spotifyApi = new SpotifyWebApi()
    spotifyApi.setAccessToken(userAccessToken)
    let tracks = await _getUserTracks(userAccessToken)
    var idNameMap = {}
    tracks.forEach(track => idNameMap[track.track.id] = track.track.name)
    let features = await spotifyApi.getAudioFeaturesForTracks(tracks.map(track => track.track.id))
    var userSongList = []
    let featuresVector = features.body.audio_features.forEach(
        feature => userSongList.push({
            name: idNameMap[feature.id],
            id: feature.id,
            feature: _normalize([
                feature.danceability,
                feature.energy,
                feature.key,
                feature.loudness,
                feature.mode,
                feature.speechiness,
                feature.acousticness,
                feature.instrumentalness,
                feature.liveness,
                feature.valence,
                feature.tempo / 100, // compare it with 100
                (feature.duration_ms / 1000.0) / 60.0, // convert to minutes
                feature.time_signature
            ])
        })
    )
    return userSongList
}

async function getUserMatrix(userAccessToken) {
    let userSongList = await getUserSongList(userAccessToken)
    let userSongListMatrix = []
    userSongList.forEach(song => userSongListMatrix.push(song.feature))
    return userSongListMatrix
}