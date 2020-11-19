'use strict';
/*!
* Last time updated: 2020-05-31 5:19:37 PM UTC
* _________________________
* RTCMultiConnection v3.7.0
* Open-Sourced: https:*github.com/muaz-khan/RTCMultiConnection
* --------------------------------------------------
* Muaz Khan     - www.MuazKhan.com
* MIT License   - www.WebRTC-Experiment.com/licence
* --------------------------------------------------
*/
var RTCMultiConnection = function(roomid, forceOptions) {

    var browserFakeUserAgent = 'Fake/5.0 (FakeOS) AppleWebKit/123 (KHTML, like Gecko) Fake/12.3.4567.89 Fake/123.45';

    (function(that) {
        if (!that) {
            return;
        }

        if (typeof window !== 'undefined') {
            return;
        }

        if (typeof global === 'undefined') {
            return;
        }

        global.navigator = {
            userAgent: browserFakeUserAgent,
            getUserMedia: function() {}
        };

        if (!global.console) {
            global.console = {};
        }

        if (typeof global.console.debug === 'undefined') {
            global.console.debug = global.console.info = global.console.error = global.console.log = global.console.log || function() {
                console.log(arguments);
            };
        }

        if (typeof document === 'undefined') {
            /*global document:true */
            that.document = {};

            document.createElement = document.captureStream = document.mozCaptureStream = function() {
                var obj = {
                    getContext: function() {
                        return obj;
                    },
                    play: function() {},
                    pause: function() {},
                    drawImage: function() {},
                    toDataURL: function() {
                        return '';
                    }
                };
                return obj;
            };

            document.addEventListener = document.removeEventListener = that.addEventListener = that.removeEventListener = function() {};

            that.HTMLVideoElement = that.HTMLMediaElement = function() {};
        }

        if (typeof io === 'undefined') {
            that.io = function() {
                return {
                    on: function(eventName, callback) {
                        callback = callback || function() {};

                        if (eventName === 'connect') {
                            callback();
                        }
                    },
                    emit: function(eventName, data, callback) {
                        callback = callback || function() {};
                        if (eventName === 'open-room' || eventName === 'join-room') {
                            callback(true, data.sessionid, null);
                        }
                    }
                };
            };
        }

        if (typeof location === 'undefined') {
            /*global location:true */
            that.location = {
                protocol: 'file:',
                href: '',
                hash: '',
                origin: 'self'
            };
        }

        if (typeof screen === 'undefined') {
            /*global screen:true */
            that.screen = {
                width: 0,
                height: 0
            };
        }

        if (typeof URL === 'undefined') {
            /*global screen:true */
            that.URL = {
                createObjectURL: function() {
                    return '';
                },
                revokeObjectURL: function() {
                    return '';
                }
            };
        }

        /*global window:true */
        that.window = global;
    })(typeof global !== 'undefined' ? global : null);

    function SocketConnection(connection, connectCallback) {
        function isData(session) {
            return !session.audio && !session.video && !session.screen && session.data;
        }

        var parameters = '';

        parameters += '?userid=' + connection.userid;
        parameters += '&sessionid=' + connection.sessionid;
        parameters += '&msgEvent=' + connection.socketMessageEvent;
        parameters += '&socketCustomEvent=' + connection.socketCustomEvent;
        parameters += '&autoCloseEntireSession=' + !!connection.autoCloseEntireSession;

        if (connection.session.broadcast === true) {
            parameters += '&oneToMany=true';
        }

        parameters += '&maxParticipantsAllowed=' + connection.maxParticipantsAllowed;

        if (connection.enableScalableBroadcast) {
            parameters += '&enableScalableBroadcast=true';
            parameters += '&maxRelayLimitPerUser=' + (connection.maxRelayLimitPerUser || 2);
        }

        parameters += '&extra=' + JSON.stringify(connection.extra || {});

        if (connection.socketCustomParameters) {
            parameters += connection.socketCustomParameters;
        }

        try {
            io.sockets = {};
        } catch (e) {};

        if (!connection.socketURL) {
            connection.socketURL = '/';
        }

        if (connection.socketURL.substr(connection.socketURL.length - 1, 1) != '/') {
            // connection.socketURL = 'https://domain.com:9001/';
            throw '"socketURL" MUST end with a slash.';
        }

        if (connection.enableLogs) {
            if (connection.socketURL == '/') {
                console.info('socket.io url is: ', location.origin + '/');
            } else {
                console.info('socket.io url is: ', connection.socketURL);
            }
        }

        try {
            connection.socket = io(connection.socketURL + parameters);
        } catch (e) {
            connection.socket = io.connect(connection.socketURL + parameters, connection.socketOptions);
        }

        var mPeer = connection.multiPeersHandler;

        connection.socket.on('extra-data-updated', function(remoteUserId, extra) {
            if (!connection.peers[remoteUserId]) return;
            connection.peers[remoteUserId].extra = extra;

            connection.onExtraDataUpdated({
                userid: remoteUserId,
                extra: extra
            });

            updateExtraBackup(remoteUserId, extra);
        });

        function updateExtraBackup(remoteUserId, extra) {
            if (!connection.peersBackup[remoteUserId]) {
                connection.peersBackup[remoteUserId] = {
                    userid: remoteUserId,
                    extra: {}
                };
            }

            connection.peersBackup[remoteUserId].extra = extra;
        }

        function onMessageEvent(message) {
            if (message.remoteUserId != connection.userid) return;

            if (connection.peers[message.sender] && connection.peers[message.sender].extra != message.message.extra) {
                connection.peers[message.sender].extra = message.extra;
                connection.onExtraDataUpdated({
                    userid: message.sender,
                    extra: message.extra
                });

                updateExtraBackup(message.sender, message.extra);
            }

            if (message.message.streamSyncNeeded && connection.peers[message.sender]) {
                var stream = connection.streamEvents[message.message.streamid];
                if (!stream || !stream.stream) {
                    return;
                }

                var action = message.message.action;

                if (action === 'ended' || action === 'inactive' || action === 'stream-removed') {
                    if (connection.peersBackup[stream.userid]) {
                        stream.extra = connection.peersBackup[stream.userid].extra;
                    }
                    connection.onstreamended(stream);
                    return;
                }

                var type = message.message.type != 'both' ? message.message.type : null;

                if (typeof stream.stream[action] == 'function') {
                    stream.stream[action](type);
                }
                return;
            }

            if (message.message === 'dropPeerConnection') {
                connection.deletePeer(message.sender);
                return;
            }

            if (message.message.allParticipants) {
                if (message.message.allParticipants.indexOf(message.sender) === -1) {
                    message.message.allParticipants.push(message.sender);
                }

                message.message.allParticipants.forEach(function(participant) {
                    mPeer[!connection.peers[participant] ? 'createNewPeer' : 'renegotiatePeer'](participant, {
                        localPeerSdpConstraints: {
                            OfferToReceiveAudio: connection.sdpConstraints.mandatory.OfferToReceiveAudio,
                            OfferToReceiveVideo: connection.sdpConstraints.mandatory.OfferToReceiveVideo
                        },
                        remotePeerSdpConstraints: {
                            OfferToReceiveAudio: connection.session.oneway ? !!connection.session.audio : connection.sdpConstraints.mandatory.OfferToReceiveAudio,
                            OfferToReceiveVideo: connection.session.oneway ? !!connection.session.video || !!connection.session.screen : connection.sdpConstraints.mandatory.OfferToReceiveVideo
                        },
                        isOneWay: !!connection.session.oneway || connection.direction === 'one-way',
                        isDataOnly: isData(connection.session)
                    });
                });
                return;
            }

            if (message.message.newParticipant) {
                if (message.message.newParticipant == connection.userid) return;
                if (!!connection.peers[message.message.newParticipant]) return;

                mPeer.createNewPeer(message.message.newParticipant, message.message.userPreferences || {
                    localPeerSdpConstraints: {
                        OfferToReceiveAudio: connection.sdpConstraints.mandatory.OfferToReceiveAudio,
                        OfferToReceiveVideo: connection.sdpConstraints.mandatory.OfferToReceiveVideo
                    },
                    remotePeerSdpConstraints: {
                        OfferToReceiveAudio: connection.session.oneway ? !!connection.session.audio : connection.sdpConstraints.mandatory.OfferToReceiveAudio,
                        OfferToReceiveVideo: connection.session.oneway ? !!connection.session.video || !!connection.session.screen : connection.sdpConstraints.mandatory.OfferToReceiveVideo
                    },
                    isOneWay: !!connection.session.oneway || connection.direction === 'one-way',
                    isDataOnly: isData(connection.session)
                });
                return;
            }

            if (message.message.readyForOffer) {
                if (connection.attachStreams.length) {
                    connection.waitingForLocalMedia = false;
                }

                if (connection.waitingForLocalMedia) {
                    // if someone is waiting to join you
                    // make sure that we've local media before making a handshake
                    setTimeout(function() {
                        onMessageEvent(message);
                    }, 1);
                    return;
                }
            }

            if (message.message.newParticipationRequest && message.sender !== connection.userid) {
                if (connection.peers[message.sender]) {
                    connection.deletePeer(message.sender);
                }

                var userPreferences = {
                    extra: message.extra || {},
                    localPeerSdpConstraints: message.message.remotePeerSdpConstraints || {
                        OfferToReceiveAudio: connection.sdpConstraints.mandatory.OfferToReceiveAudio,
                        OfferToReceiveVideo: connection.sdpConstraints.mandatory.OfferToReceiveVideo
                    },
                    remotePeerSdpConstraints: message.message.localPeerSdpConstraints || {
                        OfferToReceiveAudio: connection.session.oneway ? !!connection.session.audio : connection.sdpConstraints.mandatory.OfferToReceiveAudio,
                        OfferToReceiveVideo: connection.session.oneway ? !!connection.session.video || !!connection.session.screen : connection.sdpConstraints.mandatory.OfferToReceiveVideo
                    },
                    isOneWay: typeof message.message.isOneWay !== 'undefined' ? message.message.isOneWay : !!connection.session.oneway || connection.direction === 'one-way',
                    isDataOnly: typeof message.message.isDataOnly !== 'undefined' ? message.message.isDataOnly : isData(connection.session),
                    dontGetRemoteStream: typeof message.message.isOneWay !== 'undefined' ? message.message.isOneWay : !!connection.session.oneway || connection.direction === 'one-way',
                    dontAttachLocalStream: !!message.message.dontGetRemoteStream,
                    connectionDescription: message,
                    successCallback: function() {}
                };

                connection.onNewParticipant(message.sender, userPreferences);
                return;
            }

            if (message.message.changedUUID) {
                if (connection.peers[message.message.oldUUID]) {
                    connection.peers[message.message.newUUID] = connection.peers[message.message.oldUUID];
                    delete connection.peers[message.message.oldUUID];
                }
            }

            if (message.message.userLeft) {
                mPeer.onUserLeft(message.sender);

                if (!!message.message.autoCloseEntireSession) {
                    connection.leave();
                }

                return;
            }

            mPeer.addNegotiatedMessage(message.message, message.sender);
        }

        connection.socket.on(connection.socketMessageEvent, onMessageEvent);

        var alreadyConnected = false;

        connection.socket.resetProps = function() {
            alreadyConnected = false;
        };

        connection.socket.on('connect', function() {
            if (alreadyConnected) {
                return;
            }
            alreadyConnected = true;

            if (connection.enableLogs) {
                console.info('socket.io connection is opened.');
            }

            setTimeout(function() {
                connection.socket.emit('extra-data-updated', connection.extra);
            }, 1000);

            if (connectCallback) {
                connectCallback(connection.socket);
            }
        });

        connection.socket.on('disconnect', function(event) {
            connection.onSocketDisconnect(event);
        });

        connection.socket.on('error', function(event) {
            connection.onSocketError(event);
        });

        connection.socket.on('user-disconnected', function(remoteUserId) {
            if (remoteUserId === connection.userid) {
                return;
            }

            connection.onUserStatusChanged({
                userid: remoteUserId,
                status: 'offline',
                extra: connection.peers[remoteUserId] ? connection.peers[remoteUserId].extra || {} : {}
            });

            connection.deletePeer(remoteUserId);
        });

        connection.socket.on('user-connected', function(userid) {
            if (userid === connection.userid) {
                return;
            }

            connection.onUserStatusChanged({
                userid: userid,
                status: 'online',
                extra: connection.peers[userid] ? connection.peers[userid].extra || {} : {}
            });
        });

        connection.socket.on('closed-entire-session', function(sessionid, extra) {
            connection.leave();
            connection.onEntireSessionClosed({
                sessionid: sessionid,
                userid: sessionid,
                extra: extra
            });
        });

        connection.socket.on('userid-already-taken', function(useridAlreadyTaken, yourNewUserId) {
            connection.onUserIdAlreadyTaken(useridAlreadyTaken, yourNewUserId);
        });

        connection.socket.on('logs', function(log) {
            if (!connection.enableLogs) return;
            console.debug('server-logs', log);
        });

        connection.socket.on('number-of-broadcast-viewers-updated', function(data) {
            connection.onNumberOfBroadcastViewersUpdated(data);
        });

        connection.socket.on('set-isInitiator-true', function(sessionid) {
            if (sessionid != connection.sessionid) return;
            connection.isInitiator = true;
        });
    }

    function MultiPeers(connection) {
        var self = this;

        var skipPeers = ['getAllParticipants', 'getLength', 'selectFirst', 'streams', 'send', 'forEach'];
        connection.peers = {
            getLength: function() {
                var numberOfPeers = 0;
                for (var peer in this) {
                    if (skipPeers.indexOf(peer) == -1) {
                        numberOfPeers++;
                    }
                }
                return numberOfPeers;
            },
            selectFirst: function() {
                var firstPeer;
                for (var peer in this) {
                    if (skipPeers.indexOf(peer) == -1) {
                        firstPeer = this[peer];
                    }
                }
                return firstPeer;
            },
            getAllParticipants: function(sender) {
                var allPeers = [];
                for (var peer in this) {
                    if (skipPeers.indexOf(peer) == -1 && peer != sender) {
                        allPeers.push(peer);
                    }
                }
                return allPeers;
            },
            forEach: function(callback) {
                this.getAllParticipants().forEach(function(participant) {
                    callback(connection.peers[participant]);
                });
            },
            send: function(data, remoteUserId) {
                var that = this;

                if (!isNull(data.size) && !isNull(data.type)) {
                    if (connection.enableFileSharing) {
                        self.shareFile(data, remoteUserId);
                        return;
                    }

                    if (typeof data !== 'string') {
                        data = JSON.stringify(data);
                    }
                }

                if (data.type !== 'text' && !(data instanceof ArrayBuffer) && !(data instanceof DataView)) {
                    TextSender.send({
                        text: data,
                        channel: this,
                        connection: connection,
                        remoteUserId: remoteUserId
                    });
                    return;
                }

                if (data.type === 'text') {
                    data = JSON.stringify(data);
                }

                if (remoteUserId) {
                    var remoteUser = connection.peers[remoteUserId];
                    if (remoteUser) {
                        if (!remoteUser.channels.length) {
                            connection.peers[remoteUserId].createDataChannel();
                            connection.renegotiate(remoteUserId);
                            setTimeout(function() {
                                that.send(data, remoteUserId);
                            }, 3000);
                            return;
                        }

                        remoteUser.channels.forEach(function(channel) {
                            channel.send(data);
                        });
                        return;
                    }
                }

                this.getAllParticipants().forEach(function(participant) {
                    if (!that[participant].channels.length) {
                        connection.peers[participant].createDataChannel();
                        connection.renegotiate(participant);
                        setTimeout(function() {
                            that[participant].channels.forEach(function(channel) {
                                channel.send(data);
                            });
                        }, 3000);
                        return;
                    }

                    that[participant].channels.forEach(function(channel) {
                        channel.send(data);
                    });
                });
            }
        };

        this.uuid = connection.userid;

        this.getLocalConfig = function(remoteSdp, remoteUserId, userPreferences) {
            if (!userPreferences) {
                userPreferences = {};
            }

            return {
                streamsToShare: userPreferences.streamsToShare || {},
                rtcMultiConnection: connection,
                connectionDescription: userPreferences.connectionDescription,
                userid: remoteUserId,
                localPeerSdpConstraints: userPreferences.localPeerSdpConstraints,
                remotePeerSdpConstraints: userPreferences.remotePeerSdpConstraints,
                dontGetRemoteStream: !!userPreferences.dontGetRemoteStream,
                dontAttachLocalStream: !!userPreferences.dontAttachLocalStream,
                renegotiatingPeer: !!userPreferences.renegotiatingPeer,
                peerRef: userPreferences.peerRef,
                channels: userPreferences.channels || [],
                onLocalSdp: function(localSdp) {
                    self.onNegotiationNeeded(localSdp, remoteUserId);
                },
                onLocalCandidate: function(localCandidate) {
                    localCandidate = OnIceCandidateHandler.processCandidates(connection, localCandidate)
                    if (localCandidate) {
                        self.onNegotiationNeeded(localCandidate, remoteUserId);
                    }
                },
                remoteSdp: remoteSdp,
                onDataChannelMessage: function(message) {
                    if (!connection.fbr && connection.enableFileSharing) initFileBufferReader();

                    if (typeof message == 'string' || !connection.enableFileSharing) {
                        self.onDataChannelMessage(message, remoteUserId);
                        return;
                    }

                    var that = this;

                    if (message instanceof ArrayBuffer || message instanceof DataView) {
                        connection.fbr.convertToObject(message, function(object) {
                            that.onDataChannelMessage(object);
                        });
                        return;
                    }

                    if (message.readyForNextChunk) {
                        connection.fbr.getNextChunk(message, function(nextChunk, isLastChunk) {
                            connection.peers[remoteUserId].channels.forEach(function(channel) {
                                channel.send(nextChunk);
                            });
                        }, remoteUserId);
                        return;
                    }

                    if (message.chunkMissing) {
                        connection.fbr.chunkMissing(message);
                        return;
                    }

                    connection.fbr.addChunk(message, function(promptNextChunk) {
                        connection.peers[remoteUserId].peer.channel.send(promptNextChunk);
                    });
                },
                onDataChannelError: function(error) {
                    self.onDataChannelError(error, remoteUserId);
                },
                onDataChannelOpened: function(channel) {
                    self.onDataChannelOpened(channel, remoteUserId);
                },
                onDataChannelClosed: function(event) {
                    self.onDataChannelClosed(event, remoteUserId);
                },
                onRemoteStream: function(stream) {
                    if (connection.peers[remoteUserId]) {
                        connection.peers[remoteUserId].streams.push(stream);
                    }

                    self.onGettingRemoteMedia(stream, remoteUserId);
                },
                onRemoteStreamRemoved: function(stream) {
                    self.onRemovingRemoteMedia(stream, remoteUserId);
                },
                onPeerStateChanged: function(states) {
                    self.onPeerStateChanged(states);

                    if (states.iceConnectionState === 'new') {
                        self.onNegotiationStarted(remoteUserId, states);
                    }

                    if (states.iceConnectionState === 'connected') {
                        self.onNegotiationCompleted(remoteUserId, states);
                    }

                    if (states.iceConnectionState.search(/closed|failed/gi) !== -1) {
                        self.onUserLeft(remoteUserId);
                        self.disconnectWith(remoteUserId);
                    }
                }
            };
        };

        this.createNewPeer = function(remoteUserId, userPreferences) {
            if (connection.maxParticipantsAllowed <= connection.getAllParticipants().length) {
                return;
            }

            userPreferences = userPreferences || {};

            if (connection.isInitiator && !!connection.session.audio && connection.session.audio === 'two-way' && !userPreferences.streamsToShare) {
                userPreferences.isOneWay = false;
                userPreferences.isDataOnly = false;
                userPreferences.session = connection.session;
            }

            if (!userPreferences.isOneWay && !userPreferences.isDataOnly) {
                userPreferences.isOneWay = true;
                this.onNegotiationNeeded({
                    enableMedia: true,
                    userPreferences: userPreferences
                }, remoteUserId);
                return;
            }

            userPreferences = connection.setUserPreferences(userPreferences, remoteUserId);
            var localConfig = this.getLocalConfig(null, remoteUserId, userPreferences);
            connection.peers[remoteUserId] = new PeerInitiator(localConfig);
        };

        this.createAnsweringPeer = function(remoteSdp, remoteUserId, userPreferences) {
            userPreferences = connection.setUserPreferences(userPreferences || {}, remoteUserId);

            var localConfig = this.getLocalConfig(remoteSdp, remoteUserId, userPreferences);
            connection.peers[remoteUserId] = new PeerInitiator(localConfig);
        };

        this.renegotiatePeer = function(remoteUserId, userPreferences, remoteSdp) {
            if (!connection.peers[remoteUserId]) {
                if (connection.enableLogs) {
                    console.error('Peer (' + remoteUserId + ') does not exist. Renegotiation skipped.');
                }
                return;
            }

            if (!userPreferences) {
                userPreferences = {};
            }

            userPreferences.renegotiatingPeer = true;
            userPreferences.peerRef = connection.peers[remoteUserId].peer;
            userPreferences.channels = connection.peers[remoteUserId].channels;

            var localConfig = this.getLocalConfig(remoteSdp, remoteUserId, userPreferences);

            connection.peers[remoteUserId] = new PeerInitiator(localConfig);
        };

        this.replaceTrack = function(track, remoteUserId, isVideoTrack) {
            if (!connection.peers[remoteUserId]) {
                throw 'This peer (' + remoteUserId + ') does not exist.';
            }

            var peer = connection.peers[remoteUserId].peer;

            if (!!peer.getSenders && typeof peer.getSenders === 'function' && peer.getSenders().length) {
                peer.getSenders().forEach(function(rtpSender) {
                    if (isVideoTrack && rtpSender.track.kind === 'video') {
                        connection.peers[remoteUserId].peer.lastVideoTrack = rtpSender.track;
                        rtpSender.replaceTrack(track);
                    }

                    if (!isVideoTrack && rtpSender.track.kind === 'audio') {
                        connection.peers[remoteUserId].peer.lastAudioTrack = rtpSender.track;
                        rtpSender.replaceTrack(track);
                    }
                });
                return;
            }

            console.warn('RTPSender.replaceTrack is NOT supported.');
            this.renegotiatePeer(remoteUserId);
        };

        this.onNegotiationNeeded = function(message, remoteUserId) {};
        this.addNegotiatedMessage = function(message, remoteUserId) {
            if (message.type && message.sdp) {
                if (message.type == 'answer') {
                    if (connection.peers[remoteUserId]) {
                        connection.peers[remoteUserId].addRemoteSdp(message);
                    }
                }

                if (message.type == 'offer') {
                    if (message.renegotiatingPeer) {
                        this.renegotiatePeer(remoteUserId, null, message);
                    } else {
                        this.createAnsweringPeer(message, remoteUserId);
                    }
                }

                if (connection.enableLogs) {
                    console.log('Remote peer\'s sdp:', message.sdp);
                }
                return;
            }

            if (message.candidate) {
                if (connection.peers[remoteUserId]) {
                    connection.peers[remoteUserId].addRemoteCandidate(message);
                }

                if (connection.enableLogs) {
                    console.log('Remote peer\'s candidate pairs:', message.candidate);
                }
                return;
            }

            if (message.enableMedia) {
                connection.session = message.userPreferences.session || connection.session;

                if (connection.session.oneway && connection.attachStreams.length) {
                    connection.attachStreams = [];
                }

                if (message.userPreferences.isDataOnly && connection.attachStreams.length) {
                    connection.attachStreams.length = [];
                }

                var streamsToShare = {};
                connection.attachStreams.forEach(function(stream) {
                    streamsToShare[stream.streamid] = {
                        isAudio: !!stream.isAudio,
                        isVideo: !!stream.isVideo,
                        isScreen: !!stream.isScreen
                    };
                });
                message.userPreferences.streamsToShare = streamsToShare;

                self.onNegotiationNeeded({
                    readyForOffer: true,
                    userPreferences: message.userPreferences
                }, remoteUserId);
            }

            if (message.readyForOffer) {
                connection.onReadyForOffer(remoteUserId, message.userPreferences);
            }

            function cb(stream) {
                gumCallback(stream, message, remoteUserId);
            }
        };

        function gumCallback(stream, message, remoteUserId) {
            var streamsToShare = {};
            connection.attachStreams.forEach(function(stream) {
                streamsToShare[stream.streamid] = {
                    isAudio: !!stream.isAudio,
                    isVideo: !!stream.isVideo,
                    isScreen: !!stream.isScreen
                };
            });
            message.userPreferences.streamsToShare = streamsToShare;

            self.onNegotiationNeeded({
                readyForOffer: true,
                userPreferences: message.userPreferences
            }, remoteUserId);
        }

        this.onGettingRemoteMedia = function(stream, remoteUserId) {};
        this.onRemovingRemoteMedia = function(stream, remoteUserId) {};
        this.onGettingLocalMedia = function(localStream) {};
        this.onLocalMediaError = function(error, constraints) {
            connection.onMediaError(error, constraints);
        };

        function initFileBufferReader() {
            connection.fbr = new FileBufferReader();
            connection.fbr.onProgress = function(chunk) {
                connection.onFileProgress(chunk);
            };
            connection.fbr.onBegin = function(file) {
                connection.onFileStart(file);
            };
            connection.fbr.onEnd = function(file) {
                connection.onFileEnd(file);
            };
        }

        this.shareFile = function(file, remoteUserId) {
            initFileBufferReader();

            connection.fbr.readAsArrayBuffer(file, function(uuid) {
                var arrayOfUsers = connection.getAllParticipants();

                if (remoteUserId) {
                    arrayOfUsers = [remoteUserId];
                }

                arrayOfUsers.forEach(function(participant) {
                    connection.fbr.getNextChunk(uuid, function(nextChunk) {
                        connection.peers[participant].channels.forEach(function(channel) {
                            channel.send(nextChunk);
                        });
                    }, participant);
                });
            }, {
                userid: connection.userid,
                // extra: connection.extra,
                chunkSize: DetectRTC.browser.name === 'Firefox' ? 15 * 1000 : connection.chunkSize || 0
            });
        };

        if (typeof 'TextReceiver' !== 'undefined') {
            var textReceiver = new TextReceiver(connection);
        }

        this.onDataChannelMessage = function(message, remoteUserId) {
            textReceiver.receive(JSON.parse(message), remoteUserId, connection.peers[remoteUserId] ? connection.peers[remoteUserId].extra : {});
        };

        this.onDataChannelClosed = function(event, remoteUserId) {
            event.userid = remoteUserId;
            event.extra = connection.peers[remoteUserId] ? connection.peers[remoteUserId].extra : {};
            connection.onclose(event);
        };

        this.onDataChannelError = function(error, remoteUserId) {
            error.userid = remoteUserId;
            event.extra = connection.peers[remoteUserId] ? connection.peers[remoteUserId].extra : {};
            connection.onerror(error);
        };

        this.onDataChannelOpened = function(channel, remoteUserId) {
            // keep last channel only; we are not expecting parallel/channels channels
            if (connection.peers[remoteUserId].channels.length) {
                connection.peers[remoteUserId].channels = [channel];
                return;
            }

            connection.peers[remoteUserId].channels.push(channel);
            connection.onopen({
                userid: remoteUserId,
                extra: connection.peers[remoteUserId] ? connection.peers[remoteUserId].extra : {},
                channel: channel
            });
        };

        this.onPeerStateChanged = function(state) {
            connection.onPeerStateChanged(state);
        };

        this.onNegotiationStarted = function(remoteUserId, states) {};
        this.onNegotiationCompleted = function(remoteUserId, states) {};

        this.getRemoteStreams = function(remoteUserId) {
            remoteUserId = remoteUserId || connection.peers.getAllParticipants()[0];
            return connection.peers[remoteUserId] ? connection.peers[remoteUserId].streams : [];
        };
    }

    (function(f) {
        if (typeof exports === "object" && typeof module !== "undefined") {
            module.exports = f()
        } else if (typeof define === "function" && define.amd) {
            define([], f)
        } else {
            var g;
            if (typeof window !== "undefined") {
                g = window
            } else if (typeof global !== "undefined") {
                g = global
            } else if (typeof self !== "undefined") {
                g = self
            } else {
                g = this
            }
            g.adapter = f()
        }
    })(function() {
        var define, module, exports;
        return (function() {
            function r(e, n, t) {
                function o(i, f) {
                    if (!n[i]) {
                        if (!e[i]) {
                            var c = "function" == typeof require && require;
                            if (!f && c) return c(i, !0);
                            if (u) return u(i, !0);
                            var a = new Error("Cannot find module '" + i + "'");
                            throw a.code = "MODULE_NOT_FOUND", a
                        }
                        var p = n[i] = {
                            exports: {}
                        };
                        e[i][0].call(p.exports, function(r) {
                            var n = e[i][1][r];
                            return o(n || r)
                        }, p, p.exports, r, e, n, t)
                    }
                    return n[i].exports
                }
                for (var u = "function" == typeof require && require, i = 0; i < t.length; i++) o(t[i]);
                return o
            }
            return r
        })()({
            1: [function(require, module, exports) {
/*!
*  Copyright (c) 2016 The WebRTC project authors. All Rights Reserved.
*
*  Use of this source code is governed by a BSD-style license
*  that can be found in the LICENSE file in the root of the source
*  tree.
*/
/* eslint-env node */

                'use strict';

                var _adapter_factory = require('./adapter_factory.js');

                var adapter = (0, _adapter_factory.adapterFactory)({
                    window: window
                });
                module.exports = adapter; // this is the difference from adapter_core.

            }, {
                "./adapter_factory.js": 2
            }],
            2: [function(require, module, exports) {
                'use strict';

                Object.defineProperty(exports, "__esModule", {
                    value: true
                });
                exports.adapterFactory = adapterFactory;

                var _utils = require('./utils');

                var utils = _interopRequireWildcard(_utils);

                var _chrome_shim = require('./chrome/chrome_shim');

                var chromeShim = _interopRequireWildcard(_chrome_shim);

                var _edge_shim = require('./edge/edge_shim');

                var edgeShim = _interopRequireWildcard(_edge_shim);

                var _firefox_shim = require('./firefox/firefox_shim');

                var firefoxShim = _interopRequireWildcard(_firefox_shim);

                var _safari_shim = require('./safari/safari_shim');

                var safariShim = _interopRequireWildcard(_safari_shim);

                var _common_shim = require('./common_shim');

                var commonShim = _interopRequireWildcard(_common_shim);

                function _interopRequireWildcard(obj) {
                    if (obj && obj.__esModule) {
                        return obj;
                    } else {
                        var newObj = {};
                        if (obj != null) {
                            for (var key in obj) {
                                if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key];
                            }
                        }
                        newObj.default = obj;
                        return newObj;
                    }
                }

                // Shimming starts here.
/*!
*  Copyright (c) 2016 The WebRTC project authors. All Rights Reserved.
*
*  Use of this source code is governed by a BSD-style license
*  that can be found in the LICENSE file in the root of the source
*  tree.
*/
                function adapterFactory() {
                    var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
                        window = _ref.window;

                    var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {
                        shimChrome: true,
                        shimFirefox: true,
                        shimEdge: true,
                        shimSafari: true
                    };

                    // Utils.
                    var logging = utils.log;
                    var browserDetails = utils.detectBrowser(window);

                    var adapter = {
                        browserDetails: browserDetails,
                        commonShim: commonShim,
                        extractVersion: utils.extractVersion,
                        disableLog: utils.disableLog,
                        disableWarnings: utils.disableWarnings
                    };

                    // Shim browser if found.
                    switch (browserDetails.browser) {
                        case 'chrome':
                            if (!chromeShim || !chromeShim.shimPeerConnection || !options.shimChrome) {
                                logging('Chrome shim is not included in this adapter release.');
                                return adapter;
                            }
                            if (browserDetails.version === null) {
                                logging('Chrome shim can not determine version, not shimming.');
                                return adapter;
                            }
                            logging('adapter.js shimming chrome.');
                            // Export to the adapter global object visible in the browser.
                            adapter.browserShim = chromeShim;

                            chromeShim.shimGetUserMedia(window);
                            chromeShim.shimMediaStream(window);
                            chromeShim.shimPeerConnection(window);
                            chromeShim.shimOnTrack(window);
                            chromeShim.shimAddTrackRemoveTrack(window);
                            chromeShim.shimGetSendersWithDtmf(window);
                            chromeShim.shimGetStats(window);
                            chromeShim.shimSenderReceiverGetStats(window);
                            chromeShim.fixNegotiationNeeded(window);

                            commonShim.shimRTCIceCandidate(window);
                            commonShim.shimConnectionState(window);
                            commonShim.shimMaxMessageSize(window);
                            commonShim.shimSendThrowTypeError(window);
                            commonShim.removeAllowExtmapMixed(window);
                            break;
                        case 'firefox':
                            if (!firefoxShim || !firefoxShim.shimPeerConnection || !options.shimFirefox) {
                                logging('Firefox shim is not included in this adapter release.');
                                return adapter;
                            }
                            logging('adapter.js shimming firefox.');
                            // Export to the adapter global object visible in the browser.
                            adapter.browserShim = firefoxShim;

                            firefoxShim.shimGetUserMedia(window);
                            firefoxShim.shimPeerConnection(window);
                            firefoxShim.shimOnTrack(window);
                            firefoxShim.shimRemoveStream(window);
                            firefoxShim.shimSenderGetStats(window);
                            firefoxShim.shimReceiverGetStats(window);
                            firefoxShim.shimRTCDataChannel(window);
                            firefoxShim.shimAddTransceiver(window);
                            firefoxShim.shimCreateOffer(window);
                            firefoxShim.shimCreateAnswer(window);

                            commonShim.shimRTCIceCandidate(window);
                            commonShim.shimConnectionState(window);
                            commonShim.shimMaxMessageSize(window);
                            commonShim.shimSendThrowTypeError(window);
                            break;
                        case 'edge':
                            if (!edgeShim || !edgeShim.shimPeerConnection || !options.shimEdge) {
                                logging('MS edge shim is not included in this adapter release.');
                                return adapter;
                            }
                            logging('adapter.js shimming edge.');
                            // Export to the adapter global object visible in the browser.
                            adapter.browserShim = edgeShim;

                            edgeShim.shimGetUserMedia(window);
                            edgeShim.shimGetDisplayMedia(window);
                            edgeShim.shimPeerConnection(window);
                            edgeShim.shimReplaceTrack(window);

                            // the edge shim implements the full RTCIceCandidate object.

                            commonShim.shimMaxMessageSize(window);
                            commonShim.shimSendThrowTypeError(window);
                            break;
                        case 'safari':
                            if (!safariShim || !options.shimSafari) {
                                logging('Safari shim is not included in this adapter release.');
                                return adapter;
                            }
                            logging('adapter.js shimming safari.');
                            // Export to the adapter global object visible in the browser.
                            adapter.browserShim = safariShim;

                            safariShim.shimRTCIceServerUrls(window);
                            safariShim.shimCreateOfferLegacy(window);
                            safariShim.shimCallbacksAPI(window);
                            safariShim.shimLocalStreamsAPI(window);
                            safariShim.shimRemoteStreamsAPI(window);
                            safariShim.shimTrackEventTransceiver(window);
                            safariShim.shimGetUserMedia(window);
                            safariShim.shimAudioContext(window);

                            commonShim.shimRTCIceCandidate(window);
                            commonShim.shimMaxMessageSize(window);
                            commonShim.shimSendThrowTypeError(window);
                            commonShim.removeAllowExtmapMixed(window);
                            break;
                        default:
                            logging('Unsupported browser!');
                            break;
                    }

                    return adapter;
                }

                // Browser shims.

            }, {
                "./chrome/chrome_shim": 3,
                "./common_shim": 6,
                "./edge/edge_shim": 7,
                "./firefox/firefox_shim": 11,
                "./safari/safari_shim": 14,
                "./utils": 15
            }],
            3: [function(require, module, exports) {
/*!
*  Copyright (c) 2016 The WebRTC project authors. All Rights Reserved.
*
*  Use of this source code is governed by a BSD-style license
*  that can be found in the LICENSE file in the root of the source
*  tree.
*/
/* eslint-env node */
                'use strict';

                Object.defineProperty(exports, "__esModule", {
                    value: true
                });
                exports.shimGetDisplayMedia = exports.shimGetUserMedia = undefined;

                var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function(obj) {
                    return typeof obj;
                } : function(obj) {
                    return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
                };

                var _getusermedia = require('./getusermedia');

                Object.defineProperty(exports, 'shimGetUserMedia', {
                    enumerable: true,
                    get: function get() {
                        return _getusermedia.shimGetUserMedia;
                    }
                });

                var _getdisplaymedia = require('./getdisplaymedia');

                Object.defineProperty(exports, 'shimGetDisplayMedia', {
                    enumerable: true,
                    get: function get() {
                        return _getdisplaymedia.shimGetDisplayMedia;
                    }
                });
                exports.shimMediaStream = shimMediaStream;
                exports.shimOnTrack = shimOnTrack;
                exports.shimGetSendersWithDtmf = shimGetSendersWithDtmf;
                exports.shimGetStats = shimGetStats;
                exports.shimSenderReceiverGetStats = shimSenderReceiverGetStats;
                exports.shimAddTrackRemoveTrackWithNative = shimAddTrackRemoveTrackWithNative;
                exports.shimAddTrackRemoveTrack = shimAddTrackRemoveTrack;
                exports.shimPeerConnection = shimPeerConnection;
                exports.fixNegotiationNeeded = fixNegotiationNeeded;

                var _utils = require('../utils.js');

                var utils = _interopRequireWildcard(_utils);

                function _interopRequireWildcard(obj) {
                    if (obj && obj.__esModule) {
                        return obj;
                    } else {
                        var newObj = {};
                        if (obj != null) {
                            for (var key in obj) {
                                if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key];
                            }
                        }
                        newObj.default = obj;
                        return newObj;
                    }
                }

                function _defineProperty(obj, key, value) {
                    if (key in obj) {
                        Object.defineProperty(obj, key, {
                            value: value,
                            enumerable: true,
                            configurable: true,
                            writable: true
                        });
                    } else {
                        obj[key] = value;
                    }
                    return obj;
                }

                function shimMediaStream(window) {
                    window.MediaStream = window.MediaStream || window.webkitMediaStream;
                }

                function shimOnTrack(window) {
                    if ((typeof window === 'undefined' ? 'undefined' : _typeof(window)) === 'object' && window.RTCPeerConnection && !('ontrack' in window.RTCPeerConnection.prototype)) {
                        Object.defineProperty(window.RTCPeerConnection.prototype, 'ontrack', {
                            get: function get() {
                                return this._ontrack;
                            },
                            set: function set(f) {
                                if (this._ontrack) {
                                    this.removeEventListener('track', this._ontrack);
                                }
                                this.addEventListener('track', this._ontrack = f);
                            },

                            enumerable: true,
                            configurable: true
                        });
                        var origSetRemoteDescription = window.RTCPeerConnection.prototype.setRemoteDescription;
                        window.RTCPeerConnection.prototype.setRemoteDescription = function setRemoteDescription() {
                            var _this = this;

                            if (!this._ontrackpoly) {
                                this._ontrackpoly = function(e) {
                                    // onaddstream does not fire when a track is added to an existing
                                    // stream. But stream.onaddtrack is implemented so we use that.
                                    e.stream.addEventListener('addtrack', function(te) {
                                        var receiver = void 0;
                                        if (window.RTCPeerConnection.prototype.getReceivers) {
                                            receiver = _this.getReceivers().find(function(r) {
                                                return r.track && r.track.id === te.track.id;
                                            });
                                        } else {
                                            receiver = {
                                                track: te.track
                                            };
                                        }

                                        var event = new Event('track');
                                        event.track = te.track;
                                        event.receiver = receiver;
                                        event.transceiver = {
                                            receiver: receiver
                                        };
                                        event.streams = [e.stream];
                                        _this.dispatchEvent(event);
                                    });
                                    e.stream.getTracks().forEach(function(track) {
                                        var receiver = void 0;
                                        if (window.RTCPeerConnection.prototype.getReceivers) {
                                            receiver = _this.getReceivers().find(function(r) {
                                                return r.track && r.track.id === track.id;
                                            });
                                        } else {
                                            receiver = {
                                                track: track
                                            };
                                        }
                                        var event = new Event('track');
                                        event.track = track;
                                        event.receiver = receiver;
                                        event.transceiver = {
                                            receiver: receiver
                                        };
                                        event.streams = [e.stream];
                                        _this.dispatchEvent(event);
                                    });
                                };
                                this.addEventListener('addstream', this._ontrackpoly);
                            }
                            return origSetRemoteDescription.apply(this, arguments);
                        };
                    } else {
                        // even if RTCRtpTransceiver is in window, it is only used and
                        // emitted in unified-plan. Unfortunately this means we need
                        // to unconditionally wrap the event.
                        utils.wrapPeerConnectionEvent(window, 'track', function(e) {
                            if (!e.transceiver) {
                                Object.defineProperty(e, 'transceiver', {
                                    value: {
                                        receiver: e.receiver
                                    }
                                });
                            }
                            return e;
                        });
                    }
                }

                function shimGetSendersWithDtmf(window) {
                    // Overrides addTrack/removeTrack, depends on shimAddTrackRemoveTrack.
                    if ((typeof window === 'undefined' ? 'undefined' : _typeof(window)) === 'object' && window.RTCPeerConnection && !('getSenders' in window.RTCPeerConnection.prototype) && 'createDTMFSender' in window.RTCPeerConnection.prototype) {
                        var shimSenderWithDtmf = function shimSenderWithDtmf(pc, track) {
                            return {
                                track: track,
                                get dtmf() {
                                    if (this._dtmf === undefined) {
                                        if (track.kind === 'audio') {
                                            this._dtmf = pc.createDTMFSender(track);
                                        } else {
                                            this._dtmf = null;
                                        }
                                    }
                                    return this._dtmf;
                                },
                                _pc: pc
                            };
                        };

                        // augment addTrack when getSenders is not available.
                        if (!window.RTCPeerConnection.prototype.getSenders) {
                            window.RTCPeerConnection.prototype.getSenders = function getSenders() {
                                this._senders = this._senders || [];
                                return this._senders.slice(); // return a copy of the internal state.
                            };
                            var origAddTrack = window.RTCPeerConnection.prototype.addTrack;
                            window.RTCPeerConnection.prototype.addTrack = function addTrack(track, stream) {
                                var sender = origAddTrack.apply(this, arguments);
                                if (!sender) {
                                    sender = shimSenderWithDtmf(this, track);
                                    this._senders.push(sender);
                                }
                                return sender;
                            };

                            var origRemoveTrack = window.RTCPeerConnection.prototype.removeTrack;
                            window.RTCPeerConnection.prototype.removeTrack = function removeTrack(sender) {
                                origRemoveTrack.apply(this, arguments);
                                var idx = this._senders.indexOf(sender);
                                if (idx !== -1) {
                                    this._senders.splice(idx, 1);
                                }
                            };
                        }
                        var origAddStream = window.RTCPeerConnection.prototype.addStream;
                        window.RTCPeerConnection.prototype.addStream = function addStream(stream) {
                            var _this2 = this;

                            this._senders = this._senders || [];
                            origAddStream.apply(this, [stream]);
                            stream.getTracks().forEach(function(track) {
                                _this2._senders.push(shimSenderWithDtmf(_this2, track));
                            });
                        };

                        var origRemoveStream = window.RTCPeerConnection.prototype.removeStream;
                        window.RTCPeerConnection.prototype.removeStream = function removeStream(stream) {
                            var _this3 = this;

                            this._senders = this._senders || [];
                            origRemoveStream.apply(this, [stream]);

                            stream.getTracks().forEach(function(track) {
                                var sender = _this3._senders.find(function(s) {
                                    return s.track === track;
                                });
                                if (sender) {
                                    // remove sender
                                    _this3._senders.splice(_this3._senders.indexOf(sender), 1);
                                }
                            });
                        };
                    } else if ((typeof window === 'undefined' ? 'undefined' : _typeof(window)) === 'object' && window.RTCPeerConnection && 'getSenders' in window.RTCPeerConnection.prototype && 'createDTMFSender' in window.RTCPeerConnection.prototype && window.RTCRtpSender && !('dtmf' in window.RTCRtpSender.prototype)) {
                        var origGetSenders = window.RTCPeerConnection.prototype.getSenders;
                        window.RTCPeerConnection.prototype.getSenders = function getSenders() {
                            var _this4 = this;

                            var senders = origGetSenders.apply(this, []);
                            senders.forEach(function(sender) {
                                return sender._pc = _this4;
                            });
                            return senders;
                        };

                        Object.defineProperty(window.RTCRtpSender.prototype, 'dtmf', {
                            get: function get() {
                                if (this._dtmf === undefined) {
                                    if (this.track.kind === 'audio') {
                                        this._dtmf = this._pc.createDTMFSender(this.track);
                                    } else {
                                        this._dtmf = null;
                                    }
                                }
                                return this._dtmf;
                            }
                        });
                    }
                }

                function shimGetStats(window) {
                    if (!window.RTCPeerConnection) {
                        return;
                    }

                    var origGetStats = window.RTCPeerConnection.prototype.getStats;
                    window.RTCPeerConnection.prototype.getStats = function getStats() {
                        var _this5 = this;

                        var _arguments = Array.prototype.slice.call(arguments),
                            selector = _arguments[0],
                            onSucc = _arguments[1],
                            onErr = _arguments[2];

                        // If selector is a function then we are in the old style stats so just
                        // pass back the original getStats format to avoid breaking old users.


                        if (arguments.length > 0 && typeof selector === 'function') {
                            return origGetStats.apply(this, arguments);
                        }

                        // When spec-style getStats is supported, return those when called with
                        // either no arguments or the selector argument is null.
                        if (origGetStats.length === 0 && (arguments.length === 0 || typeof selector !== 'function')) {
                            return origGetStats.apply(this, []);
                        }

                        var fixChromeStats_ = function fixChromeStats_(response) {
                            var standardReport = {};
                            var reports = response.result();
                            reports.forEach(function(report) {
                                var standardStats = {
                                    id: report.id,
                                    timestamp: report.timestamp,
                                    type: {
                                        localcandidate: 'local-candidate',
                                        remotecandidate: 'remote-candidate'
                                    } [report.type] || report.type
                                };
                                report.names().forEach(function(name) {
                                    standardStats[name] = report.stat(name);
                                });
                                standardReport[standardStats.id] = standardStats;
                            });

                            return standardReport;
                        };

                        // shim getStats with maplike support
                        var makeMapStats = function makeMapStats(stats) {
                            return new Map(Object.keys(stats).map(function(key) {
                                return [key, stats[key]];
                            }));
                        };

                        if (arguments.length >= 2) {
                            var successCallbackWrapper_ = function successCallbackWrapper_(response) {
                                onSucc(makeMapStats(fixChromeStats_(response)));
                            };

                            return origGetStats.apply(this, [successCallbackWrapper_, selector]);
                        }

                        // promise-support
                        return new Promise(function(resolve, reject) {
                            origGetStats.apply(_this5, [function(response) {
                                resolve(makeMapStats(fixChromeStats_(response)));
                            }, reject]);
                        }).then(onSucc, onErr);
                    };
                }

                function shimSenderReceiverGetStats(window) {
                    if (!((typeof window === 'undefined' ? 'undefined' : _typeof(window)) === 'object' && window.RTCPeerConnection && window.RTCRtpSender && window.RTCRtpReceiver)) {
                        return;
                    }

                    // shim sender stats.
                    if (!('getStats' in window.RTCRtpSender.prototype)) {
                        var origGetSenders = window.RTCPeerConnection.prototype.getSenders;
                        if (origGetSenders) {
                            window.RTCPeerConnection.prototype.getSenders = function getSenders() {
                                var _this6 = this;

                                var senders = origGetSenders.apply(this, []);
                                senders.forEach(function(sender) {
                                    return sender._pc = _this6;
                                });
                                return senders;
                            };
                        }

                        var origAddTrack = window.RTCPeerConnection.prototype.addTrack;
                        if (origAddTrack) {
                            window.RTCPeerConnection.prototype.addTrack = function addTrack() {
                                var sender = origAddTrack.apply(this, arguments);
                                sender._pc = this;
                                return sender;
                            };
                        }
                        window.RTCRtpSender.prototype.getStats = function getStats() {
                            var sender = this;
                            return this._pc.getStats().then(function(result) {
                                return (
                                    /* Note: this will include stats of all senders that
                                     *   send a track with the same id as sender.track as
                                     *   it is not possible to identify the RTCRtpSender.
                                     */
                                    utils.filterStats(result, sender.track, true)
                                );
                            });
                        };
                    }

                    // shim receiver stats.
                    if (!('getStats' in window.RTCRtpReceiver.prototype)) {
                        var origGetReceivers = window.RTCPeerConnection.prototype.getReceivers;
                        if (origGetReceivers) {
                            window.RTCPeerConnection.prototype.getReceivers = function getReceivers() {
                                var _this7 = this;

                                var receivers = origGetReceivers.apply(this, []);
                                receivers.forEach(function(receiver) {
                                    return receiver._pc = _this7;
                                });
                                return receivers;
                            };
                        }
                        utils.wrapPeerConnectionEvent(window, 'track', function(e) {
                            e.receiver._pc = e.srcElement;
                            return e;
                        });
                        window.RTCRtpReceiver.prototype.getStats = function getStats() {
                            var receiver = this;
                            return this._pc.getStats().then(function(result) {
                                return utils.filterStats(result, receiver.track, false);
                            });
                        };
                    }

                    if (!('getStats' in window.RTCRtpSender.prototype && 'getStats' in window.RTCRtpReceiver.prototype)) {
                        return;
                    }

                    // shim RTCPeerConnection.getStats(track).
                    var origGetStats = window.RTCPeerConnection.prototype.getStats;
                    window.RTCPeerConnection.prototype.getStats = function getStats() {
                        if (arguments.length > 0 && arguments[0] instanceof window.MediaStreamTrack) {
                            var track = arguments[0];
                            var sender = void 0;
                            var receiver = void 0;
                            var err = void 0;
                            this.getSenders().forEach(function(s) {
                                if (s.track === track) {
                                    if (sender) {
                                        err = true;
                                    } else {
                                        sender = s;
                                    }
                                }
                            });
                            this.getReceivers().forEach(function(r) {
                                if (r.track === track) {
                                    if (receiver) {
                                        err = true;
                                    } else {
                                        receiver = r;
                                    }
                                }
                                return r.track === track;
                            });
                            if (err || sender && receiver) {
                                return Promise.reject(new DOMException('There are more than one sender or receiver for the track.', 'InvalidAccessError'));
                            } else if (sender) {
                                return sender.getStats();
                            } else if (receiver) {
                                return receiver.getStats();
                            }
                            return Promise.reject(new DOMException('There is no sender or receiver for the track.', 'InvalidAccessError'));
                        }
                        return origGetStats.apply(this, arguments);
                    };
                }

                function shimAddTrackRemoveTrackWithNative(window) {
                    // shim addTrack/removeTrack with native variants in order to make
                    // the interactions with legacy getLocalStreams behave as in other browsers.
                    // Keeps a mapping stream.id => [stream, rtpsenders...]
                    window.RTCPeerConnection.prototype.getLocalStreams = function getLocalStreams() {
                        var _this8 = this;

                        this._shimmedLocalStreams = this._shimmedLocalStreams || {};
                        return Object.keys(this._shimmedLocalStreams).map(function(streamId) {
                            return _this8._shimmedLocalStreams[streamId][0];
                        });
                    };

                    var origAddTrack = window.RTCPeerConnection.prototype.addTrack;
                    window.RTCPeerConnection.prototype.addTrack = function addTrack(track, stream) {
                        if (!stream) {
                            return origAddTrack.apply(this, arguments);
                        }
                        this._shimmedLocalStreams = this._shimmedLocalStreams || {};

                        var sender = origAddTrack.apply(this, arguments);
                        if (!this._shimmedLocalStreams[stream.id]) {
                            this._shimmedLocalStreams[stream.id] = [stream, sender];
                        } else if (this._shimmedLocalStreams[stream.id].indexOf(sender) === -1) {
                            this._shimmedLocalStreams[stream.id].push(sender);
                        }
                        return sender;
                    };

                    var origAddStream = window.RTCPeerConnection.prototype.addStream;
                    window.RTCPeerConnection.prototype.addStream = function addStream(stream) {
                        var _this9 = this;

                        this._shimmedLocalStreams = this._shimmedLocalStreams || {};

                        stream.getTracks().forEach(function(track) {
                            var alreadyExists = _this9.getSenders().find(function(s) {
                                return s.track === track;
                            });
                            if (alreadyExists) {
                                throw new DOMException('Track already exists.', 'InvalidAccessError');
                            }
                        });
                        var existingSenders = this.getSenders();
                        origAddStream.apply(this, arguments);
                        var newSenders = this.getSenders().filter(function(newSender) {
                            return existingSenders.indexOf(newSender) === -1;
                        });
                        this._shimmedLocalStreams[stream.id] = [stream].concat(newSenders);
                    };

                    var origRemoveStream = window.RTCPeerConnection.prototype.removeStream;
                    window.RTCPeerConnection.prototype.removeStream = function removeStream(stream) {
                        this._shimmedLocalStreams = this._shimmedLocalStreams || {};
                        delete this._shimmedLocalStreams[stream.id];
                        return origRemoveStream.apply(this, arguments);
                    };

                    var origRemoveTrack = window.RTCPeerConnection.prototype.removeTrack;
                    window.RTCPeerConnection.prototype.removeTrack = function removeTrack(sender) {
                        var _this10 = this;

                        this._shimmedLocalStreams = this._shimmedLocalStreams || {};
                        if (sender) {
                            Object.keys(this._shimmedLocalStreams).forEach(function(streamId) {
                                var idx = _this10._shimmedLocalStreams[streamId].indexOf(sender);
                                if (idx !== -1) {
                                    _this10._shimmedLocalStreams[streamId].splice(idx, 1);
                                }
                                if (_this10._shimmedLocalStreams[streamId].length === 1) {
                                    delete _this10._shimmedLocalStreams[streamId];
                                }
                            });
                        }
                        return origRemoveTrack.apply(this, arguments);
                    };
                }

                function shimAddTrackRemoveTrack(window) {
                    if (!window.RTCPeerConnection) {
                        return;
                    }
                    var browserDetails = utils.detectBrowser(window);
                    // shim addTrack and removeTrack.
                    if (window.RTCPeerConnection.prototype.addTrack && browserDetails.version >= 65) {
                        return shimAddTrackRemoveTrackWithNative(window);
                    }

                    // also shim pc.getLocalStreams when addTrack is shimmed
                    // to return the original streams.
                    var origGetLocalStreams = window.RTCPeerConnection.prototype.getLocalStreams;
                    window.RTCPeerConnection.prototype.getLocalStreams = function getLocalStreams() {
                        var _this11 = this;

                        var nativeStreams = origGetLocalStreams.apply(this);
                        this._reverseStreams = this._reverseStreams || {};
                        return nativeStreams.map(function(stream) {
                            return _this11._reverseStreams[stream.id];
                        });
                    };

                    var origAddStream = window.RTCPeerConnection.prototype.addStream;
                    window.RTCPeerConnection.prototype.addStream = function addStream(stream) {
                        var _this12 = this;

                        this._streams = this._streams || {};
                        this._reverseStreams = this._reverseStreams || {};

                        stream.getTracks().forEach(function(track) {
                            var alreadyExists = _this12.getSenders().find(function(s) {
                                return s.track === track;
                            });
                            if (alreadyExists) {
                                throw new DOMException('Track already exists.', 'InvalidAccessError');
                            }
                        });
                        // Add identity mapping for consistency with addTrack.
                        // Unless this is being used with a stream from addTrack.
                        if (!this._reverseStreams[stream.id]) {
                            var newStream = new window.MediaStream(stream.getTracks());
                            this._streams[stream.id] = newStream;
                            this._reverseStreams[newStream.id] = stream;
                            stream = newStream;
                        }
                        origAddStream.apply(this, [stream]);
                    };

                    var origRemoveStream = window.RTCPeerConnection.prototype.removeStream;
                    window.RTCPeerConnection.prototype.removeStream = function removeStream(stream) {
                        this._streams = this._streams || {};
                        this._reverseStreams = this._reverseStreams || {};

                        origRemoveStream.apply(this, [this._streams[stream.id] || stream]);
                        delete this._reverseStreams[this._streams[stream.id] ? this._streams[stream.id].id : stream.id];
                        delete this._streams[stream.id];
                    };

                    window.RTCPeerConnection.prototype.addTrack = function addTrack(track, stream) {
                        var _this13 = this;

                        if (this.signalingState === 'closed') {
                            throw new DOMException('The RTCPeerConnection\'s signalingState is \'closed\'.', 'InvalidStateError');
                        }
                        var streams = [].slice.call(arguments, 1);
                        if (streams.length !== 1 || !streams[0].getTracks().find(function(t) {
                                return t === track;
                            })) {
                            // this is not fully correct but all we can manage without
                            // [[associated MediaStreams]] internal slot.
                            throw new DOMException('The adapter.js addTrack polyfill only supports a single ' + ' stream which is associated with the specified track.', 'NotSupportedError');
                        }

                        var alreadyExists = this.getSenders().find(function(s) {
                            return s.track === track;
                        });
                        if (alreadyExists) {
                            throw new DOMException('Track already exists.', 'InvalidAccessError');
                        }

                        this._streams = this._streams || {};
                        this._reverseStreams = this._reverseStreams || {};
                        var oldStream = this._streams[stream.id];
                        if (oldStream) {
                            // this is using odd Chrome behaviour, use with caution:
                            // https://bugs.chromium.org/p/webrtc/issues/detail?id=7815
                            // Note: we rely on the high-level addTrack/dtmf shim to
                            // create the sender with a dtmf sender.
                            oldStream.addTrack(track);

                            // Trigger ONN async.
                            Promise.resolve().then(function() {
                                _this13.dispatchEvent(new Event('negotiationneeded'));
                            });
                        } else {
                            var newStream = new window.MediaStream([track]);
                            this._streams[stream.id] = newStream;
                            this._reverseStreams[newStream.id] = stream;
                            this.addStream(newStream);
                        }
                        return this.getSenders().find(function(s) {
                            return s.track === track;
                        });
                    };

                    // replace the internal stream id with the external one and
                    // vice versa.
                    function replaceInternalStreamId(pc, description) {
                        var sdp = description.sdp;
                        Object.keys(pc._reverseStreams || []).forEach(function(internalId) {
                            var externalStream = pc._reverseStreams[internalId];
                            var internalStream = pc._streams[externalStream.id];
                            sdp = sdp.replace(new RegExp(internalStream.id, 'g'), externalStream.id);
                        });
                        return new RTCSessionDescription({
                            type: description.type,
                            sdp: sdp
                        });
                    }

                    function replaceExternalStreamId(pc, description) {
                        var sdp = description.sdp;
                        Object.keys(pc._reverseStreams || []).forEach(function(internalId) {
                            var externalStream = pc._reverseStreams[internalId];
                            var internalStream = pc._streams[externalStream.id];
                            sdp = sdp.replace(new RegExp(externalStream.id, 'g'), internalStream.id);
                        });
                        return new RTCSessionDescription({
                            type: description.type,
                            sdp: sdp
                        });
                    }
                    ['createOffer', 'createAnswer'].forEach(function(method) {
                        var nativeMethod = window.RTCPeerConnection.prototype[method];
                        var methodObj = _defineProperty({}, method, function() {
                            var _this14 = this;

                            var args = arguments;
                            var isLegacyCall = arguments.length && typeof arguments[0] === 'function';
                            if (isLegacyCall) {
                                return nativeMethod.apply(this, [function(description) {
                                    var desc = replaceInternalStreamId(_this14, description);
                                    args[0].apply(null, [desc]);
                                }, function(err) {
                                    if (args[1]) {
                                        args[1].apply(null, err);
                                    }
                                }, arguments[2]]);
                            }
                            return nativeMethod.apply(this, arguments).then(function(description) {
                                return replaceInternalStreamId(_this14, description);
                            });
                        });
                        window.RTCPeerConnection.prototype[method] = methodObj[method];
                    });

                    var origSetLocalDescription = window.RTCPeerConnection.prototype.setLocalDescription;
                    window.RTCPeerConnection.prototype.setLocalDescription = function setLocalDescription() {
                        if (!arguments.length || !arguments[0].type) {
                            return origSetLocalDescription.apply(this, arguments);
                        }
                        arguments[0] = replaceExternalStreamId(this, arguments[0]);
                        return origSetLocalDescription.apply(this, arguments);
                    };

                    // TODO: mangle getStats: https://w3c.github.io/webrtc-stats/#dom-rtcmediastreamstats-streamidentifier

                    var origLocalDescription = Object.getOwnPropertyDescriptor(window.RTCPeerConnection.prototype, 'localDescription');
                    Object.defineProperty(window.RTCPeerConnection.prototype, 'localDescription', {
                        get: function get() {
                            var description = origLocalDescription.get.apply(this);
                            if (description.type === '') {
                                return description;
                            }
                            return replaceInternalStreamId(this, description);
                        }
                    });

                    window.RTCPeerConnection.prototype.removeTrack = function removeTrack(sender) {
                        var _this15 = this;

                        if (this.signalingState === 'closed') {
                            throw new DOMException('The RTCPeerConnection\'s signalingState is \'closed\'.', 'InvalidStateError');
                        }
                        // We can not yet check for sender instanceof RTCRtpSender
                        // since we shim RTPSender. So we check if sender._pc is set.
                        if (!sender._pc) {
                            throw new DOMException('Argument 1 of RTCPeerConnection.removeTrack ' + 'does not implement interface RTCRtpSender.', 'TypeError');
                        }
                        var isLocal = sender._pc === this;
                        if (!isLocal) {
                            throw new DOMException('Sender was not created by this connection.', 'InvalidAccessError');
                        }

                        // Search for the native stream the senders track belongs to.
                        this._streams = this._streams || {};
                        var stream = void 0;
                        Object.keys(this._streams).forEach(function(streamid) {
                            var hasTrack = _this15._streams[streamid].getTracks().find(function(track) {
                                return sender.track === track;
                            });
                            if (hasTrack) {
                                stream = _this15._streams[streamid];
                            }
                        });

                        if (stream) {
                            if (stream.getTracks().length === 1) {
                                // if this is the last track of the stream, remove the stream. This
                                // takes care of any shimmed _senders.
                                this.removeStream(this._reverseStreams[stream.id]);
                            } else {
                                // relying on the same odd chrome behaviour as above.
                                stream.removeTrack(sender.track);
                            }
                            this.dispatchEvent(new Event('negotiationneeded'));
                        }
                    };
                }

                function shimPeerConnection(window) {
                    var browserDetails = utils.detectBrowser(window);

                    if (!window.RTCPeerConnection && window.webkitRTCPeerConnection) {
                        // very basic support for old versions.
                        window.RTCPeerConnection = window.webkitRTCPeerConnection;
                    }
                    if (!window.RTCPeerConnection) {
                        return;
                    }

                    var addIceCandidateNullSupported = window.RTCPeerConnection.prototype.addIceCandidate.length === 0;

                    // shim implicit creation of RTCSessionDescription/RTCIceCandidate
                    if (browserDetails.version < 53) {
                        ['setLocalDescription', 'setRemoteDescription', 'addIceCandidate'].forEach(function(method) {
                            var nativeMethod = window.RTCPeerConnection.prototype[method];
                            var methodObj = _defineProperty({}, method, function() {
                                arguments[0] = new(method === 'addIceCandidate' ? window.RTCIceCandidate : window.RTCSessionDescription)(arguments[0]);
                                return nativeMethod.apply(this, arguments);
                            });
                            window.RTCPeerConnection.prototype[method] = methodObj[method];
                        });
                    }

                    // support for addIceCandidate(null or undefined)
                    var nativeAddIceCandidate = window.RTCPeerConnection.prototype.addIceCandidate;
                    window.RTCPeerConnection.prototype.addIceCandidate = function addIceCandidate() {
                        if (!addIceCandidateNullSupported && !arguments[0]) {
                            if (arguments[1]) {
                                arguments[1].apply(null);
                            }
                            return Promise.resolve();
                        }
                        // Firefox 68+ emits and processes {candidate: "", ...}, ignore
                        // in older versions. Native support planned for Chrome M77.
                        if (browserDetails.version < 78 && arguments[0] && arguments[0].candidate === '') {
                            return Promise.resolve();
                        }
                        return nativeAddIceCandidate.apply(this, arguments);
                    };
                }

                // Attempt to fix ONN in plan-b mode.
                function fixNegotiationNeeded(window) {
                    var browserDetails = utils.detectBrowser(window);
                    utils.wrapPeerConnectionEvent(window, 'negotiationneeded', function(e) {
                        var pc = e.target;
                        if (browserDetails.version < 72 || pc.getConfiguration && pc.getConfiguration().sdpSemantics === 'plan-b') {
                            if (pc.signalingState !== 'stable') {
                                return;
                            }
                        }
                        return e;
                    });
                }

            }, {
                "../utils.js": 15,
                "./getdisplaymedia": 4,
                "./getusermedia": 5
            }],
            4: [function(require, module, exports) {
/*!
*  Copyright (c) 2018 The adapter.js project authors. All Rights Reserved.
*
*  Use of this source code is governed by a BSD-style license
*  that can be found in the LICENSE file in the root of the source
*  tree.
*/
/* eslint-env node */
                'use strict';

                Object.defineProperty(exports, "__esModule", {
                    value: true
                });
                exports.shimGetDisplayMedia = shimGetDisplayMedia;

                function shimGetDisplayMedia(window, getSourceId) {
                    if (window.navigator.mediaDevices && 'getDisplayMedia' in window.navigator.mediaDevices) {
                        return;
                    }
                    if (!window.navigator.mediaDevices) {
                        return;
                    }
                    // getSourceId is a function that returns a promise resolving with
                    // the sourceId of the screen/window/tab to be shared.
                    if (typeof getSourceId !== 'function') {
                        console.error('shimGetDisplayMedia: getSourceId argument is not ' + 'a function');
                        return;
                    }
                    window.navigator.mediaDevices.getDisplayMedia = function getDisplayMedia(constraints) {
                        return getSourceId(constraints).then(function(sourceId) {
                            var widthSpecified = constraints.video && constraints.video.width;
                            var heightSpecified = constraints.video && constraints.video.height;
                            var frameRateSpecified = constraints.video && constraints.video.frameRate;
                            constraints.video = {
                                mandatory: {
                                    chromeMediaSource: 'desktop',
                                    chromeMediaSourceId: sourceId,
                                    maxFrameRate: frameRateSpecified || 3
                                }
                            };
                            if (widthSpecified) {
                                constraints.video.mandatory.maxWidth = widthSpecified;
                            }
                            if (heightSpecified) {
                                constraints.video.mandatory.maxHeight = heightSpecified;
                            }
                            return window.navigator.mediaDevices.getUserMedia(constraints);
                        });
                    };
                }

            }, {}],
            5: [function(require, module, exports) {
/*!
*  Copyright (c) 2016 The WebRTC project authors. All Rights Reserved.
*
*  Use of this source code is governed by a BSD-style license
*  that can be found in the LICENSE file in the root of the source
*  tree.
*/
/* eslint-env node */
                'use strict';

                Object.defineProperty(exports, "__esModule", {
                    value: true
                });

                var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function(obj) {
                    return typeof obj;
                } : function(obj) {
                    return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
                };

                exports.shimGetUserMedia = shimGetUserMedia;

                var _utils = require('../utils.js');

                var utils = _interopRequireWildcard(_utils);

                function _interopRequireWildcard(obj) {
                    if (obj && obj.__esModule) {
                        return obj;
                    } else {
                        var newObj = {};
                        if (obj != null) {
                            for (var key in obj) {
                                if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key];
                            }
                        }
                        newObj.default = obj;
                        return newObj;
                    }
                }

                var logging = utils.log;

                function shimGetUserMedia(window) {
                    var navigator = window && window.navigator;

                    if (!navigator.mediaDevices) {
                        return;
                    }

                    var browserDetails = utils.detectBrowser(window);

                    var constraintsToChrome_ = function constraintsToChrome_(c) {
                        if ((typeof c === 'undefined' ? 'undefined' : _typeof(c)) !== 'object' || c.mandatory || c.optional) {
                            return c;
                        }
                        var cc = {};
                        Object.keys(c).forEach(function(key) {
                            if (key === 'require' || key === 'advanced' || key === 'mediaSource') {
                                return;
                            }
                            var r = _typeof(c[key]) === 'object' ? c[key] : {
                                ideal: c[key]
                            };
                            if (r.exact !== undefined && typeof r.exact === 'number') {
                                r.min = r.max = r.exact;
                            }
                            var oldname_ = function oldname_(prefix, name) {
                                if (prefix) {
                                    return prefix + name.charAt(0).toUpperCase() + name.slice(1);
                                }
                                return name === 'deviceId' ? 'sourceId' : name;
                            };
                            if (r.ideal !== undefined) {
                                cc.optional = cc.optional || [];
                                var oc = {};
                                if (typeof r.ideal === 'number') {
                                    oc[oldname_('min', key)] = r.ideal;
                                    cc.optional.push(oc);
                                    oc = {};
                                    oc[oldname_('max', key)] = r.ideal;
                                    cc.optional.push(oc);
                                } else {
                                    oc[oldname_('', key)] = r.ideal;
                                    cc.optional.push(oc);
                                }
                            }
                            if (r.exact !== undefined && typeof r.exact !== 'number') {
                                cc.mandatory = cc.mandatory || {};
                                cc.mandatory[oldname_('', key)] = r.exact;
                            } else {
                                ['min', 'max'].forEach(function(mix) {
                                    if (r[mix] !== undefined) {
                                        cc.mandatory = cc.mandatory || {};
                                        cc.mandatory[oldname_(mix, key)] = r[mix];
                                    }
                                });
                            }
                        });
                        if (c.advanced) {
                            cc.optional = (cc.optional || []).concat(c.advanced);
                        }
                        return cc;
                    };

                    var shimConstraints_ = function shimConstraints_(constraints, func) {
                        if (browserDetails.version >= 61) {
                            return func(constraints);
                        }
                        constraints = JSON.parse(JSON.stringify(constraints));
                        if (constraints && _typeof(constraints.audio) === 'object') {
                            var remap = function remap(obj, a, b) {
                                if (a in obj && !(b in obj)) {
                                    obj[b] = obj[a];
                                    delete obj[a];
                                }
                            };
                            constraints = JSON.parse(JSON.stringify(constraints));
                            remap(constraints.audio, 'autoGainControl', 'googAutoGainControl');
                            remap(constraints.audio, 'noiseSuppression', 'googNoiseSuppression');
                            constraints.audio = constraintsToChrome_(constraints.audio);
                        }
                        if (constraints && _typeof(constraints.video) === 'object') {
                            // Shim facingMode for mobile & surface pro.
                            var face = constraints.video.facingMode;
                            face = face && ((typeof face === 'undefined' ? 'undefined' : _typeof(face)) === 'object' ? face : {
                                ideal: face
                            });
                            var getSupportedFacingModeLies = browserDetails.version < 66;

                            if (face && (face.exact === 'user' || face.exact === 'environment' || face.ideal === 'user' || face.ideal === 'environment') && !(navigator.mediaDevices.getSupportedConstraints && navigator.mediaDevices.getSupportedConstraints().facingMode && !getSupportedFacingModeLies)) {
                                delete constraints.video.facingMode;
                                var matches = void 0;
                                if (face.exact === 'environment' || face.ideal === 'environment') {
                                    matches = ['back', 'rear'];
                                } else if (face.exact === 'user' || face.ideal === 'user') {
                                    matches = ['front'];
                                }
                                if (matches) {
                                    // Look for matches in label, or use last cam for back (typical).
                                    return navigator.mediaDevices.enumerateDevices().then(function(devices) {
                                        devices = devices.filter(function(d) {
                                            return d.kind === 'videoinput';
                                        });
                                        var dev = devices.find(function(d) {
                                            return matches.some(function(match) {
                                                return d.label.toLowerCase().includes(match);
                                            });
                                        });
                                        if (!dev && devices.length && matches.includes('back')) {
                                            dev = devices[devices.length - 1]; // more likely the back cam
                                        }
                                        if (dev) {
                                            constraints.video.deviceId = face.exact ? {
                                                exact: dev.deviceId
                                            } : {
                                                ideal: dev.deviceId
                                            };
                                        }
                                        constraints.video = constraintsToChrome_(constraints.video);
                                        logging('chrome: ' + JSON.stringify(constraints));
                                        return func(constraints);
                                    });
                                }
                            }
                            constraints.video = constraintsToChrome_(constraints.video);
                        }
                        logging('chrome: ' + JSON.stringify(constraints));
                        return func(constraints);
                    };

                    var shimError_ = function shimError_(e) {
                        if (browserDetails.version >= 64) {
                            return e;
                        }
                        return {
                            name: {
                                PermissionDeniedError: 'NotAllowedError',
                                PermissionDismissedError: 'NotAllowedError',
                                InvalidStateError: 'NotAllowedError',
                                DevicesNotFoundError: 'NotFoundError',
                                ConstraintNotSatisfiedError: 'OverconstrainedError',
                                TrackStartError: 'NotReadableError',
                                MediaDeviceFailedDueToShutdown: 'NotAllowedError',
                                MediaDeviceKillSwitchOn: 'NotAllowedError',
                                TabCaptureError: 'AbortError',
                                ScreenCaptureError: 'AbortError',
                                DeviceCaptureError: 'AbortError'
                            } [e.name] || e.name,
                            message: e.message,
                            constraint: e.constraint || e.constraintName,
                            toString: function toString() {
                                return this.name + (this.message && ': ') + this.message;
                            }
                        };
                    };

                    var getUserMedia_ = function getUserMedia_(constraints, onSuccess, onError) {
                        shimConstraints_(constraints, function(c) {
                            navigator.webkitGetUserMedia(c, onSuccess, function(e) {
                                if (onError) {
                                    onError(shimError_(e));
                                }
                            });
                        });
                    };
                    navigator.getUserMedia = getUserMedia_.bind(navigator);

                    // Even though Chrome 45 has navigator.mediaDevices and a getUserMedia
                    // function which returns a Promise, it does not accept spec-style
                    // constraints.
                    if (navigator.mediaDevices.getUserMedia) {
                        var origGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
                        navigator.mediaDevices.getUserMedia = function(cs) {
                            return shimConstraints_(cs, function(c) {
                                return origGetUserMedia(c).then(function(stream) {
                                    if (c.audio && !stream.getAudioTracks().length || c.video && !stream.getVideoTracks().length) {
                                        stream.getTracks().forEach(function(track) {
                                            track.stop();
                                        });
                                        throw new DOMException('', 'NotFoundError');
                                    }
                                    return stream;
                                }, function(e) {
                                    return Promise.reject(shimError_(e));
                                });
                            });
                        };
                    }
                }

            }, {
                "../utils.js": 15
            }],
            6: [function(require, module, exports) {
/*!
*  Copyright (c) 2017 The WebRTC project authors. All Rights Reserved.
*
*  Use of this source code is governed by a BSD-style license
*  that can be found in the LICENSE file in the root of the source
*  tree.
*/
/* eslint-env node */
                'use strict';

                Object.defineProperty(exports, "__esModule", {
                    value: true
                });

                var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function(obj) {
                    return typeof obj;
                } : function(obj) {
                    return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
                };

                exports.shimRTCIceCandidate = shimRTCIceCandidate;
                exports.shimMaxMessageSize = shimMaxMessageSize;
                exports.shimSendThrowTypeError = shimSendThrowTypeError;
                exports.shimConnectionState = shimConnectionState;
                exports.removeAllowExtmapMixed = removeAllowExtmapMixed;

                var _sdp = require('sdp');

                var _sdp2 = _interopRequireDefault(_sdp);

                var _utils = require('./utils');

                var utils = _interopRequireWildcard(_utils);

                function _interopRequireWildcard(obj) {
                    if (obj && obj.__esModule) {
                        return obj;
                    } else {
                        var newObj = {};
                        if (obj != null) {
                            for (var key in obj) {
                                if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key];
                            }
                        }
                        newObj.default = obj;
                        return newObj;
                    }
                }

                function _interopRequireDefault(obj) {
                    return obj && obj.__esModule ? obj : {
                        default: obj
                    };
                }

                function shimRTCIceCandidate(window) {
                    // foundation is arbitrarily chosen as an indicator for full support for
                    // https://w3c.github.io/webrtc-pc/#rtcicecandidate-interface
                    if (!window.RTCIceCandidate || window.RTCIceCandidate && 'foundation' in window.RTCIceCandidate.prototype) {
                        return;
                    }

                    var NativeRTCIceCandidate = window.RTCIceCandidate;
                    window.RTCIceCandidate = function RTCIceCandidate(args) {
                        // Remove the a= which shouldn't be part of the candidate string.
                        if ((typeof args === 'undefined' ? 'undefined' : _typeof(args)) === 'object' && args.candidate && args.candidate.indexOf('a=') === 0) {
                            args = JSON.parse(JSON.stringify(args));
                            args.candidate = args.candidate.substr(2);
                        }

                        if (args.candidate && args.candidate.length) {
                            // Augment the native candidate with the parsed fields.
                            var nativeCandidate = new NativeRTCIceCandidate(args);
                            var parsedCandidate = _sdp2.default.parseCandidate(args.candidate);
                            var augmentedCandidate = Object.assign(nativeCandidate, parsedCandidate);

                            // Add a serializer that does not serialize the extra attributes.
                            augmentedCandidate.toJSON = function toJSON() {
                                return {
                                    candidate: augmentedCandidate.candidate,
                                    sdpMid: augmentedCandidate.sdpMid,
                                    sdpMLineIndex: augmentedCandidate.sdpMLineIndex,
                                    usernameFragment: augmentedCandidate.usernameFragment
                                };
                            };
                            return augmentedCandidate;
                        }
                        return new NativeRTCIceCandidate(args);
                    };
                    window.RTCIceCandidate.prototype = NativeRTCIceCandidate.prototype;

                    // Hook up the augmented candidate in onicecandidate and
                    // addEventListener('icecandidate', ...)
                    utils.wrapPeerConnectionEvent(window, 'icecandidate', function(e) {
                        if (e.candidate) {
                            Object.defineProperty(e, 'candidate', {
                                value: new window.RTCIceCandidate(e.candidate),
                                writable: 'false'
                            });
                        }
                        return e;
                    });
                }

                function shimMaxMessageSize(window) {
                    if (!window.RTCPeerConnection) {
                        return;
                    }
                    var browserDetails = utils.detectBrowser(window);

                    if (!('sctp' in window.RTCPeerConnection.prototype)) {
                        Object.defineProperty(window.RTCPeerConnection.prototype, 'sctp', {
                            get: function get() {
                                return typeof this._sctp === 'undefined' ? null : this._sctp;
                            }
                        });
                    }

                    var sctpInDescription = function sctpInDescription(description) {
                        if (!description || !description.sdp) {
                            return false;
                        }
                        var sections = _sdp2.default.splitSections(description.sdp);
                        sections.shift();
                        return sections.some(function(mediaSection) {
                            var mLine = _sdp2.default.parseMLine(mediaSection);
                            return mLine && mLine.kind === 'application' && mLine.protocol.indexOf('SCTP') !== -1;
                        });
                    };

                    var getRemoteFirefoxVersion = function getRemoteFirefoxVersion(description) {
                        // TODO: Is there a better solution for detecting Firefox?
                        var match = description.sdp.match(/mozilla...THIS_IS_SDPARTA-(\d+)/);
                        if (match === null || match.length < 2) {
                            return -1;
                        }
                        var version = parseInt(match[1], 10);
                        // Test for NaN (yes, this is ugly)
                        return version !== version ? -1 : version;
                    };

                    var getCanSendMaxMessageSize = function getCanSendMaxMessageSize(remoteIsFirefox) {
                        // Every implementation we know can send at least 64 KiB.
                        // Note: Although Chrome is technically able to send up to 256 KiB, the
                        //       data does not reach the other peer reliably.
                        //       See: https://bugs.chromium.org/p/webrtc/issues/detail?id=8419
                        var canSendMaxMessageSize = 65536;
                        if (browserDetails.browser === 'firefox') {
                            if (browserDetails.version < 57) {
                                if (remoteIsFirefox === -1) {
                                    // FF < 57 will send in 16 KiB chunks using the deprecated PPID
                                    // fragmentation.
                                    canSendMaxMessageSize = 16384;
                                } else {
                                    // However, other FF (and RAWRTC) can reassemble PPID-fragmented
                                    // messages. Thus, supporting ~2 GiB when sending.
                                    canSendMaxMessageSize = 2147483637;
                                }
                            } else if (browserDetails.version < 60) {
                                // Currently, all FF >= 57 will reset the remote maximum message size
                                // to the default value when a data channel is created at a later
                                // stage. :(
                                // See: https://bugzilla.mozilla.org/show_bug.cgi?id=1426831
                                canSendMaxMessageSize = browserDetails.version === 57 ? 65535 : 65536;
                            } else {
                                // FF >= 60 supports sending ~2 GiB
                                canSendMaxMessageSize = 2147483637;
                            }
                        }
                        return canSendMaxMessageSize;
                    };

                    var getMaxMessageSize = function getMaxMessageSize(description, remoteIsFirefox) {
                        // Note: 65536 bytes is the default value from the SDP spec. Also,
                        //       every implementation we know supports receiving 65536 bytes.
                        var maxMessageSize = 65536;

                        // FF 57 has a slightly incorrect default remote max message size, so
                        // we need to adjust it here to avoid a failure when sending.
                        // See: https://bugzilla.mozilla.org/show_bug.cgi?id=1425697
                        if (browserDetails.browser === 'firefox' && browserDetails.version === 57) {
                            maxMessageSize = 65535;
                        }

                        var match = _sdp2.default.matchPrefix(description.sdp, 'a=max-message-size:');
                        if (match.length > 0) {
                            maxMessageSize = parseInt(match[0].substr(19), 10);
                        } else if (browserDetails.browser === 'firefox' && remoteIsFirefox !== -1) {
                            // If the maximum message size is not present in the remote SDP and
                            // both local and remote are Firefox, the remote peer can receive
                            // ~2 GiB.
                            maxMessageSize = 2147483637;
                        }
                        return maxMessageSize;
                    };

                    var origSetRemoteDescription = window.RTCPeerConnection.prototype.setRemoteDescription;
                    window.RTCPeerConnection.prototype.setRemoteDescription = function setRemoteDescription() {
                        this._sctp = null;
                        // Chrome decided to not expose .sctp in plan-b mode.
                        // As usual, adapter.js has to do an 'ugly worakaround'
                        // to cover up the mess.
                        if (browserDetails.browser === 'chrome' && browserDetails.version >= 76) {
                            var _getConfiguration = this.getConfiguration(),
                                sdpSemantics = _getConfiguration.sdpSemantics;

                            if (sdpSemantics === 'plan-b') {
                                Object.defineProperty(this, 'sctp', {
                                    get: function get() {
                                        return typeof this._sctp === 'undefined' ? null : this._sctp;
                                    },

                                    enumerable: true,
                                    configurable: true
                                });
                            }
                        }

                        if (sctpInDescription(arguments[0])) {
                            // Check if the remote is FF.
                            var isFirefox = getRemoteFirefoxVersion(arguments[0]);

                            // Get the maximum message size the local peer is capable of sending
                            var canSendMMS = getCanSendMaxMessageSize(isFirefox);

                            // Get the maximum message size of the remote peer.
                            var remoteMMS = getMaxMessageSize(arguments[0], isFirefox);

                            // Determine final maximum message size
                            var maxMessageSize = void 0;
                            if (canSendMMS === 0 && remoteMMS === 0) {
                                maxMessageSize = Number.POSITIVE_INFINITY;
                            } else if (canSendMMS === 0 || remoteMMS === 0) {
                                maxMessageSize = Math.max(canSendMMS, remoteMMS);
                            } else {
                                maxMessageSize = Math.min(canSendMMS, remoteMMS);
                            }

                            // Create a dummy RTCSctpTransport object and the 'maxMessageSize'
                            // attribute.
                            var sctp = {};
                            Object.defineProperty(sctp, 'maxMessageSize', {
                                get: function get() {
                                    return maxMessageSize;
                                }
                            });
                            this._sctp = sctp;
                        }

                        return origSetRemoteDescription.apply(this, arguments);
                    };
                }

                function shimSendThrowTypeError(window) {
                    if (!(window.RTCPeerConnection && 'createDataChannel' in window.RTCPeerConnection.prototype)) {
                        return;
                    }

                    // Note: Although Firefox >= 57 has a native implementation, the maximum
                    //       message size can be reset for all data channels at a later stage.
                    //       See: https://bugzilla.mozilla.org/show_bug.cgi?id=1426831

                    function wrapDcSend(dc, pc) {
                        var origDataChannelSend = dc.send;
                        dc.send = function send() {
                            var data = arguments[0];
                            var length = data.length || data.size || data.byteLength;
                            if (dc.readyState === 'open' && pc.sctp && length > pc.sctp.maxMessageSize) {
                                throw new TypeError('Message too large (can send a maximum of ' + pc.sctp.maxMessageSize + ' bytes)');
                            }
                            return origDataChannelSend.apply(dc, arguments);
                        };
                    }
                    var origCreateDataChannel = window.RTCPeerConnection.prototype.createDataChannel;
                    window.RTCPeerConnection.prototype.createDataChannel = function createDataChannel() {
                        var dataChannel = origCreateDataChannel.apply(this, arguments);
                        wrapDcSend(dataChannel, this);
                        return dataChannel;
                    };
                    utils.wrapPeerConnectionEvent(window, 'datachannel', function(e) {
                        wrapDcSend(e.channel, e.target);
                        return e;
                    });
                }

                /* shims RTCConnectionState by pretending it is the same as iceConnectionState.
                 * See https://bugs.chromium.org/p/webrtc/issues/detail?id=6145#c12
                 * for why this is a valid hack in Chrome. In Firefox it is slightly incorrect
                 * since DTLS failures would be hidden. See
                 * https://bugzilla.mozilla.org/show_bug.cgi?id=1265827
                 * for the Firefox tracking bug.
                 */
                function shimConnectionState(window) {
                    if (!window.RTCPeerConnection || 'connectionState' in window.RTCPeerConnection.prototype) {
                        return;
                    }
                    var proto = window.RTCPeerConnection.prototype;
                    Object.defineProperty(proto, 'connectionState', {
                        get: function get() {
                            return {
                                completed: 'connected',
                                checking: 'connecting'
                            } [this.iceConnectionState] || this.iceConnectionState;
                        },

                        enumerable: true,
                        configurable: true
                    });
                    Object.defineProperty(proto, 'onconnectionstatechange', {
                        get: function get() {
                            return this._onconnectionstatechange || null;
                        },
                        set: function set(cb) {
                            if (this._onconnectionstatechange) {
                                this.removeEventListener('connectionstatechange', this._onconnectionstatechange);
                                delete this._onconnectionstatechange;
                            }
                            if (cb) {
                                this.addEventListener('connectionstatechange', this._onconnectionstatechange = cb);
                            }
                        },

                        enumerable: true,
                        configurable: true
                    });

                    ['setLocalDescription', 'setRemoteDescription'].forEach(function(method) {
                        var origMethod = proto[method];
                        proto[method] = function() {
                            if (!this._connectionstatechangepoly) {
                                this._connectionstatechangepoly = function(e) {
                                    var pc = e.target;
                                    if (pc._lastConnectionState !== pc.connectionState) {
                                        pc._lastConnectionState = pc.connectionState;
                                        var newEvent = new Event('connectionstatechange', e);
                                        pc.dispatchEvent(newEvent);
                                    }
                                    return e;
                                };
                                this.addEventListener('iceconnectionstatechange', this._connectionstatechangepoly);
                            }
                            return origMethod.apply(this, arguments);
                        };
                    });
                }

                function removeAllowExtmapMixed(window) {
                    /* remove a=extmap-allow-mixed for Chrome < M71 */
                    if (!window.RTCPeerConnection) {
                        return;
                    }
                    var browserDetails = utils.detectBrowser(window);
                    if (browserDetails.browser === 'chrome' && browserDetails.version >= 71) {
                        return;
                    }
                    var nativeSRD = window.RTCPeerConnection.prototype.setRemoteDescription;
                    window.RTCPeerConnection.prototype.setRemoteDescription = function setRemoteDescription(desc) {
                        if (desc && desc.sdp && desc.sdp.indexOf('\na=extmap-allow-mixed') !== -1) {
                            desc.sdp = desc.sdp.split('\n').filter(function(line) {
                                return line.trim() !== 'a=extmap-allow-mixed';
                            }).join('\n');
                        }
                        return nativeSRD.apply(this, arguments);
                    };
                }

            }, {
                "./utils": 15,
                "sdp": 17
            }],
            7: [function(require, module, exports) {
/*!
*  Copyright (c) 2016 The WebRTC project authors. All Rights Reserved.
*
*  Use of this source code is governed by a BSD-style license
*  that can be found in the LICENSE file in the root of the source
*  tree.
*/
/* eslint-env node */
                'use strict';

                Object.defineProperty(exports, "__esModule", {
                    value: true
                });
                exports.shimGetDisplayMedia = exports.shimGetUserMedia = undefined;

                var _getusermedia = require('./getusermedia');

                Object.defineProperty(exports, 'shimGetUserMedia', {
                    enumerable: true,
                    get: function get() {
                        return _getusermedia.shimGetUserMedia;
                    }
                });

                var _getdisplaymedia = require('./getdisplaymedia');

                Object.defineProperty(exports, 'shimGetDisplayMedia', {
                    enumerable: true,
                    get: function get() {
                        return _getdisplaymedia.shimGetDisplayMedia;
                    }
                });
                exports.shimPeerConnection = shimPeerConnection;
                exports.shimReplaceTrack = shimReplaceTrack;

                var _utils = require('../utils');

                var utils = _interopRequireWildcard(_utils);

                var _filtericeservers = require('./filtericeservers');

                var _rtcpeerconnectionShim = require('rtcpeerconnection-shim');

                var _rtcpeerconnectionShim2 = _interopRequireDefault(_rtcpeerconnectionShim);

                function _interopRequireDefault(obj) {
                    return obj && obj.__esModule ? obj : {
                        default: obj
                    };
                }

                function _interopRequireWildcard(obj) {
                    if (obj && obj.__esModule) {
                        return obj;
                    } else {
                        var newObj = {};
                        if (obj != null) {
                            for (var key in obj) {
                                if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key];
                            }
                        }
                        newObj.default = obj;
                        return newObj;
                    }
                }

                function shimPeerConnection(window) {
                    var browserDetails = utils.detectBrowser(window);

                    if (window.RTCIceGatherer) {
                        if (!window.RTCIceCandidate) {
                            window.RTCIceCandidate = function RTCIceCandidate(args) {
                                return args;
                            };
                        }
                        if (!window.RTCSessionDescription) {
                            window.RTCSessionDescription = function RTCSessionDescription(args) {
                                return args;
                            };
                        }
                        // this adds an additional event listener to MediaStrackTrack that signals
                        // when a tracks enabled property was changed. Workaround for a bug in
                        // addStream, see below. No longer required in 15025+
                        if (browserDetails.version < 15025) {
                            var origMSTEnabled = Object.getOwnPropertyDescriptor(window.MediaStreamTrack.prototype, 'enabled');
                            Object.defineProperty(window.MediaStreamTrack.prototype, 'enabled', {
                                set: function set(value) {
                                    origMSTEnabled.set.call(this, value);
                                    var ev = new Event('enabled');
                                    ev.enabled = value;
                                    this.dispatchEvent(ev);
                                }
                            });
                        }
                    }

                    // ORTC defines the DTMF sender a bit different.
                    // https://github.com/w3c/ortc/issues/714
                    if (window.RTCRtpSender && !('dtmf' in window.RTCRtpSender.prototype)) {
                        Object.defineProperty(window.RTCRtpSender.prototype, 'dtmf', {
                            get: function get() {
                                if (this._dtmf === undefined) {
                                    if (this.track.kind === 'audio') {
                                        this._dtmf = new window.RTCDtmfSender(this);
                                    } else if (this.track.kind === 'video') {
                                        this._dtmf = null;
                                    }
                                }
                                return this._dtmf;
                            }
                        });
                    }
                    // Edge currently only implements the RTCDtmfSender, not the
                    // RTCDTMFSender alias. See http://draft.ortc.org/#rtcdtmfsender2*
                    if (window.RTCDtmfSender && !window.RTCDTMFSender) {
                        window.RTCDTMFSender = window.RTCDtmfSender;
                    }

                    var RTCPeerConnectionShim = (0, _rtcpeerconnectionShim2.default)(window, browserDetails.version);
                    window.RTCPeerConnection = function RTCPeerConnection(config) {
                        if (config && config.iceServers) {
                            config.iceServers = (0, _filtericeservers.filterIceServers)(config.iceServers, browserDetails.version);
                            utils.log('ICE servers after filtering:', config.iceServers);
                        }
                        return new RTCPeerConnectionShim(config);
                    };
                    window.RTCPeerConnection.prototype = RTCPeerConnectionShim.prototype;
                }

                function shimReplaceTrack(window) {
                    // ORTC has replaceTrack -- https://github.com/w3c/ortc/issues/614
                    if (window.RTCRtpSender && !('replaceTrack' in window.RTCRtpSender.prototype)) {
                        window.RTCRtpSender.prototype.replaceTrack = window.RTCRtpSender.prototype.setTrack;
                    }
                }

            }, {
                "../utils": 15,
                "./filtericeservers": 8,
                "./getdisplaymedia": 9,
                "./getusermedia": 10,
                "rtcpeerconnection-shim": 16
            }],
            8: [function(require, module, exports) {
/*!
*  Copyright (c) 2018 The WebRTC project authors. All Rights Reserved.
*
*  Use of this source code is governed by a BSD-style license
*  that can be found in the LICENSE file in the root of the source
*  tree.
*/
/* eslint-env node */
                'use strict';

                Object.defineProperty(exports, "__esModule", {
                    value: true
                });
                exports.filterIceServers = filterIceServers;

                var _utils = require('../utils');

                var utils = _interopRequireWildcard(_utils);

                function _interopRequireWildcard(obj) {
                    if (obj && obj.__esModule) {
                        return obj;
                    } else {
                        var newObj = {};
                        if (obj != null) {
                            for (var key in obj) {
                                if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key];
                            }
                        }
                        newObj.default = obj;
                        return newObj;
                    }
                }

                // Edge does not like
                // 1) stun: filtered after 14393 unless ?transport=udp is present
                // 2) turn: that does not have all of turn:host:port?transport=udp
                // 3) turn: with ipv6 addresses
                // 4) turn: occurring muliple times
                function filterIceServers(iceServers, edgeVersion) {
                    var hasTurn = false;
                    iceServers = JSON.parse(JSON.stringify(iceServers));
                    return iceServers.filter(function(server) {
                        if (server && (server.urls || server.url)) {
                            var urls = server.urls || server.url;
                            if (server.url && !server.urls) {
                                utils.deprecated('RTCIceServer.url', 'RTCIceServer.urls');
                            }
                            var isString = typeof urls === 'string';
                            if (isString) {
                                urls = [urls];
                            }
                            urls = urls.filter(function(url) {
                                // filter STUN unconditionally.
                                if (url.indexOf('stun:') === 0) {
                                    return false;
                                }

                                var validTurn = url.startsWith('turn') && !url.startsWith('turn:[') && url.includes('transport=udp');
                                if (validTurn && !hasTurn) {
                                    hasTurn = true;
                                    return true;
                                }
                                return validTurn && !hasTurn;
                            });

                            delete server.url;
                            server.urls = isString ? urls[0] : urls;
                            return !!urls.length;
                        }
                    });
                }

            }, {
                "../utils": 15
            }],
            9: [function(require, module, exports) {
/*!
*  Copyright (c) 2018 The adapter.js project authors. All Rights Reserved.
*
*  Use of this source code is governed by a BSD-style license
*  that can be found in the LICENSE file in the root of the source
*  tree.
*/
/* eslint-env node */
                'use strict';

                Object.defineProperty(exports, "__esModule", {
                    value: true
                });
                exports.shimGetDisplayMedia = shimGetDisplayMedia;

                function shimGetDisplayMedia(window) {
                    if (!('getDisplayMedia' in window.navigator)) {
                        return;
                    }
                    if (!window.navigator.mediaDevices) {
                        return;
                    }
                    if (window.navigator.mediaDevices && 'getDisplayMedia' in window.navigator.mediaDevices) {
                        return;
                    }
                    window.navigator.mediaDevices.getDisplayMedia = window.navigator.getDisplayMedia.bind(window.navigator);
                }

            }, {}],
            10: [function(require, module, exports) {
/*!
*  Copyright (c) 2016 The WebRTC project authors. All Rights Reserved.
*
*  Use of this source code is governed by a BSD-style license
*  that can be found in the LICENSE file in the root of the source
*  tree.
*/
/* eslint-env node */
                'use strict';

                Object.defineProperty(exports, "__esModule", {
                    value: true
                });
                exports.shimGetUserMedia = shimGetUserMedia;

                function shimGetUserMedia(window) {
                    var navigator = window && window.navigator;

                    var shimError_ = function shimError_(e) {
                        return {
                            name: {
                                PermissionDeniedError: 'NotAllowedError'
                            } [e.name] || e.name,
                            message: e.message,
                            constraint: e.constraint,
                            toString: function toString() {
                                return this.name;
                            }
                        };
                    };

                    // getUserMedia error shim.
                    var origGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
                    navigator.mediaDevices.getUserMedia = function(c) {
                        return origGetUserMedia(c).catch(function(e) {
                            return Promise.reject(shimError_(e));
                        });
                    };
                }

            }, {}],
            11: [function(require, module, exports) {
/*!
*  Copyright (c) 2016 The WebRTC project authors. All Rights Reserved.
*
*  Use of this source code is governed by a BSD-style license
*  that can be found in the LICENSE file in the root of the source
*  tree.
*/
/* eslint-env node */
                'use strict';

                Object.defineProperty(exports, "__esModule", {
                    value: true
                });
                exports.shimGetDisplayMedia = exports.shimGetUserMedia = undefined;

                var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function(obj) {
                    return typeof obj;
                } : function(obj) {
                    return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
                };

                var _getusermedia = require('./getusermedia');

                Object.defineProperty(exports, 'shimGetUserMedia', {
                    enumerable: true,
                    get: function get() {
                        return _getusermedia.shimGetUserMedia;
                    }
                });

                var _getdisplaymedia = require('./getdisplaymedia');

                Object.defineProperty(exports, 'shimGetDisplayMedia', {
                    enumerable: true,
                    get: function get() {
                        return _getdisplaymedia.shimGetDisplayMedia;
                    }
                });
                exports.shimOnTrack = shimOnTrack;
                exports.shimPeerConnection = shimPeerConnection;
                exports.shimSenderGetStats = shimSenderGetStats;
                exports.shimReceiverGetStats = shimReceiverGetStats;
                exports.shimRemoveStream = shimRemoveStream;
                exports.shimRTCDataChannel = shimRTCDataChannel;
                exports.shimAddTransceiver = shimAddTransceiver;
                exports.shimCreateOffer = shimCreateOffer;
                exports.shimCreateAnswer = shimCreateAnswer;

                var _utils = require('../utils');

                var utils = _interopRequireWildcard(_utils);

                function _interopRequireWildcard(obj) {
                    if (obj && obj.__esModule) {
                        return obj;
                    } else {
                        var newObj = {};
                        if (obj != null) {
                            for (var key in obj) {
                                if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key];
                            }
                        }
                        newObj.default = obj;
                        return newObj;
                    }
                }

                function _defineProperty(obj, key, value) {
                    if (key in obj) {
                        Object.defineProperty(obj, key, {
                            value: value,
                            enumerable: true,
                            configurable: true,
                            writable: true
                        });
                    } else {
                        obj[key] = value;
                    }
                    return obj;
                }

                function shimOnTrack(window) {
                    if ((typeof window === 'undefined' ? 'undefined' : _typeof(window)) === 'object' && window.RTCTrackEvent && 'receiver' in window.RTCTrackEvent.prototype && !('transceiver' in window.RTCTrackEvent.prototype)) {
                        Object.defineProperty(window.RTCTrackEvent.prototype, 'transceiver', {
                            get: function get() {
                                return {
                                    receiver: this.receiver
                                };
                            }
                        });
                    }
                }

                function shimPeerConnection(window) {
                    var browserDetails = utils.detectBrowser(window);

                    if ((typeof window === 'undefined' ? 'undefined' : _typeof(window)) !== 'object' || !(window.RTCPeerConnection || window.mozRTCPeerConnection)) {
                        return; // probably media.peerconnection.enabled=false in about:config
                    }
                    if (!window.RTCPeerConnection && window.mozRTCPeerConnection) {
                        // very basic support for old versions.
                        window.RTCPeerConnection = window.mozRTCPeerConnection;
                    }

                    if (browserDetails.version < 53) {
                        // shim away need for obsolete RTCIceCandidate/RTCSessionDescription.
                        ['setLocalDescription', 'setRemoteDescription', 'addIceCandidate'].forEach(function(method) {
                            var nativeMethod = window.RTCPeerConnection.prototype[method];
                            var methodObj = _defineProperty({}, method, function() {
                                arguments[0] = new(method === 'addIceCandidate' ? window.RTCIceCandidate : window.RTCSessionDescription)(arguments[0]);
                                return nativeMethod.apply(this, arguments);
                            });
                            window.RTCPeerConnection.prototype[method] = methodObj[method];
                        });
                    }

                    // support for addIceCandidate(null or undefined)
                    // as well as ignoring {sdpMid, candidate: ""}
                    if (browserDetails.version < 68) {
                        var nativeAddIceCandidate = window.RTCPeerConnection.prototype.addIceCandidate;
                        window.RTCPeerConnection.prototype.addIceCandidate = function addIceCandidate() {
                            if (!arguments[0]) {
                                if (arguments[1]) {
                                    arguments[1].apply(null);
                                }
                                return Promise.resolve();
                            }
                            // Firefox 68+ emits and processes {candidate: "", ...}, ignore
                            // in older versions.
                            if (arguments[0] && arguments[0].candidate === '') {
                                return Promise.resolve();
                            }
                            return nativeAddIceCandidate.apply(this, arguments);
                        };
                    }

                    var modernStatsTypes = {
                        inboundrtp: 'inbound-rtp',
                        outboundrtp: 'outbound-rtp',
                        candidatepair: 'candidate-pair',
                        localcandidate: 'local-candidate',
                        remotecandidate: 'remote-candidate'
                    };

                    var nativeGetStats = window.RTCPeerConnection.prototype.getStats;
                    window.RTCPeerConnection.prototype.getStats = function getStats() {
                        var _arguments = Array.prototype.slice.call(arguments),
                            selector = _arguments[0],
                            onSucc = _arguments[1],
                            onErr = _arguments[2];

                        return nativeGetStats.apply(this, [selector || null]).then(function(stats) {
                            if (browserDetails.version < 53 && !onSucc) {
                                // Shim only promise getStats with spec-hyphens in type names
                                // Leave callback version alone; misc old uses of forEach before Map
                                try {
                                    stats.forEach(function(stat) {
                                        stat.type = modernStatsTypes[stat.type] || stat.type;
                                    });
                                } catch (e) {
                                    if (e.name !== 'TypeError') {
                                        throw e;
                                    }
                                    // Avoid TypeError: "type" is read-only, in old versions. 34-43ish
                                    stats.forEach(function(stat, i) {
                                        stats.set(i, Object.assign({}, stat, {
                                            type: modernStatsTypes[stat.type] || stat.type
                                        }));
                                    });
                                }
                            }
                            return stats;
                        }).then(onSucc, onErr);
                    };
                }

                function shimSenderGetStats(window) {
                    if (!((typeof window === 'undefined' ? 'undefined' : _typeof(window)) === 'object' && window.RTCPeerConnection && window.RTCRtpSender)) {
                        return;
                    }
                    if (window.RTCRtpSender && 'getStats' in window.RTCRtpSender.prototype) {
                        return;
                    }
                    var origGetSenders = window.RTCPeerConnection.prototype.getSenders;
                    if (origGetSenders) {
                        window.RTCPeerConnection.prototype.getSenders = function getSenders() {
                            var _this = this;

                            var senders = origGetSenders.apply(this, []);
                            senders.forEach(function(sender) {
                                return sender._pc = _this;
                            });
                            return senders;
                        };
                    }

                    var origAddTrack = window.RTCPeerConnection.prototype.addTrack;
                    if (origAddTrack) {
                        window.RTCPeerConnection.prototype.addTrack = function addTrack() {
                            var sender = origAddTrack.apply(this, arguments);
                            sender._pc = this;
                            return sender;
                        };
                    }
                    window.RTCRtpSender.prototype.getStats = function getStats() {
                        return this.track ? this._pc.getStats(this.track) : Promise.resolve(new Map());
                    };
                }

                function shimReceiverGetStats(window) {
                    if (!((typeof window === 'undefined' ? 'undefined' : _typeof(window)) === 'object' && window.RTCPeerConnection && window.RTCRtpSender)) {
                        return;
                    }
                    if (window.RTCRtpSender && 'getStats' in window.RTCRtpReceiver.prototype) {
                        return;
                    }
                    var origGetReceivers = window.RTCPeerConnection.prototype.getReceivers;
                    if (origGetReceivers) {
                        window.RTCPeerConnection.prototype.getReceivers = function getReceivers() {
                            var _this2 = this;

                            var receivers = origGetReceivers.apply(this, []);
                            receivers.forEach(function(receiver) {
                                return receiver._pc = _this2;
                            });
                            return receivers;
                        };
                    }
                    utils.wrapPeerConnectionEvent(window, 'track', function(e) {
                        e.receiver._pc = e.srcElement;
                        return e;
                    });
                    window.RTCRtpReceiver.prototype.getStats = function getStats() {
                        return this._pc.getStats(this.track);
                    };
                }

                function shimRemoveStream(window) {
                    if (!window.RTCPeerConnection || 'removeStream' in window.RTCPeerConnection.prototype) {
                        return;
                    }
                    window.RTCPeerConnection.prototype.removeStream = function removeStream(stream) {
                        var _this3 = this;

                        utils.deprecated('removeStream', 'removeTrack');
                        this.getSenders().forEach(function(sender) {
                            if (sender.track && stream.getTracks().includes(sender.track)) {
                                _this3.removeTrack(sender);
                            }
                        });
                    };
                }

                function shimRTCDataChannel(window) {
                    // rename DataChannel to RTCDataChannel (native fix in FF60):
                    // https://bugzilla.mozilla.org/show_bug.cgi?id=1173851
                    if (window.DataChannel && !window.RTCDataChannel) {
                        window.RTCDataChannel = window.DataChannel;
                    }
                }

                function shimAddTransceiver(window) {
                    // https://github.com/webrtcHacks/adapter/issues/998#issuecomment-516921647
                    // Firefox ignores the init sendEncodings options passed to addTransceiver
                    // https://bugzilla.mozilla.org/show_bug.cgi?id=1396918
                    if (!((typeof window === 'undefined' ? 'undefined' : _typeof(window)) === 'object' && window.RTCPeerConnection)) {
                        return;
                    }
                    var origAddTransceiver = window.RTCPeerConnection.prototype.addTransceiver;
                    if (origAddTransceiver) {
                        window.RTCPeerConnection.prototype.addTransceiver = function addTransceiver() {
                            this.setParametersPromises = [];
                            var initParameters = arguments[1];
                            var shouldPerformCheck = initParameters && 'sendEncodings' in initParameters;
                            if (shouldPerformCheck) {
                                // If sendEncodings params are provided, validate grammar
                                initParameters.sendEncodings.forEach(function(encodingParam) {
                                    if ('rid' in encodingParam) {
                                        var ridRegex = /^[a-z0-9]{0,16}$/i;
                                        if (!ridRegex.test(encodingParam.rid)) {
                                            throw new TypeError('Invalid RID value provided.');
                                        }
                                    }
                                    if ('scaleResolutionDownBy' in encodingParam) {
                                        if (!(parseFloat(encodingParam.scaleResolutionDownBy) >= 1.0)) {
                                            throw new RangeError('scale_resolution_down_by must be >= 1.0');
                                        }
                                    }
                                    if ('maxFramerate' in encodingParam) {
                                        if (!(parseFloat(encodingParam.maxFramerate) >= 0)) {
                                            throw new RangeError('max_framerate must be >= 0.0');
                                        }
                                    }
                                });
                            }
                            var transceiver = origAddTransceiver.apply(this, arguments);
                            if (shouldPerformCheck) {
                                // Check if the init options were applied. If not we do this in an
                                // asynchronous way and save the promise reference in a global object.
                                // This is an ugly hack, but at the same time is way more robust than
                                // checking the sender parameters before and after the createOffer
                                // Also note that after the createoffer we are not 100% sure that
                                // the params were asynchronously applied so we might miss the
                                // opportunity to recreate offer.
                                var sender = transceiver.sender;

                                var params = sender.getParameters();
                                if (!('encodings' in params)) {
                                    params.encodings = initParameters.sendEncodings;
                                    this.setParametersPromises.push(sender.setParameters(params).catch(function() {}));
                                }
                            }
                            return transceiver;
                        };
                    }
                }

                function shimCreateOffer(window) {
                    // https://github.com/webrtcHacks/adapter/issues/998#issuecomment-516921647
                    // Firefox ignores the init sendEncodings options passed to addTransceiver
                    // https://bugzilla.mozilla.org/show_bug.cgi?id=1396918
                    if (!((typeof window === 'undefined' ? 'undefined' : _typeof(window)) === 'object' && window.RTCPeerConnection)) {
                        return;
                    }
                    var origCreateOffer = window.RTCPeerConnection.prototype.createOffer;
                    window.RTCPeerConnection.prototype.createOffer = function createOffer() {
                        var _this4 = this,
                            _arguments2 = arguments;

                        if (this.setParametersPromises && this.setParametersPromises.length) {
                            return Promise.all(this.setParametersPromises).then(function() {
                                return origCreateOffer.apply(_this4, _arguments2);
                            }).finally(function() {
                                _this4.setParametersPromises = [];
                            });
                        }
                        return origCreateOffer.apply(this, arguments);
                    };
                }

                function shimCreateAnswer(window) {
                    // https://github.com/webrtcHacks/adapter/issues/998#issuecomment-516921647
                    // Firefox ignores the init sendEncodings options passed to addTransceiver
                    // https://bugzilla.mozilla.org/show_bug.cgi?id=1396918
                    if (!((typeof window === 'undefined' ? 'undefined' : _typeof(window)) === 'object' && window.RTCPeerConnection)) {
                        return;
                    }
                    var origCreateAnswer = window.RTCPeerConnection.prototype.createAnswer;
                    window.RTCPeerConnection.prototype.createAnswer = function createAnswer() {
                        var _this5 = this,
                            _arguments3 = arguments;

                        if (this.setParametersPromises && this.setParametersPromises.length) {
                            return Promise.all(this.setParametersPromises).then(function() {
                                return origCreateAnswer.apply(_this5, _arguments3);
                            }).finally(function() {
                                _this5.setParametersPromises = [];
                            });
                        }
                        return origCreateAnswer.apply(this, arguments);
                    };
                }

            }, {
                "../utils": 15,
                "./getdisplaymedia": 12,
                "./getusermedia": 13
            }],
            12: [function(require, module, exports) {
/*!
*  Copyright (c) 2018 The adapter.js project authors. All Rights Reserved.
*
*  Use of this source code is governed by a BSD-style license
*  that can be found in the LICENSE file in the root of the source
*  tree.
*/
/* eslint-env node */
                'use strict';

                Object.defineProperty(exports, "__esModule", {
                    value: true
                });
                exports.shimGetDisplayMedia = shimGetDisplayMedia;

                function shimGetDisplayMedia(window, preferredMediaSource) {
                    if (window.navigator.mediaDevices && 'getDisplayMedia' in window.navigator.mediaDevices) {
                        return;
                    }
                    if (!window.navigator.mediaDevices) {
                        return;
                    }
                    window.navigator.mediaDevices.getDisplayMedia = function getDisplayMedia(constraints) {
                        if (!(constraints && constraints.video)) {
                            var err = new DOMException('getDisplayMedia without video ' + 'constraints is undefined');
                            err.name = 'NotFoundError';
                            // from https://heycam.github.io/webidl/#idl-DOMException-error-names
                            err.code = 8;
                            return Promise.reject(err);
                        }
                        if (constraints.video === true) {
                            constraints.video = {
                                mediaSource: preferredMediaSource
                            };
                        } else {
                            constraints.video.mediaSource = preferredMediaSource;
                        }
                        return window.navigator.mediaDevices.getUserMedia(constraints);
                    };
                }

            }, {}],
            13: [function(require, module, exports) {
/*!
*  Copyright (c) 2016 The WebRTC project authors. All Rights Reserved.
*
*  Use of this source code is governed by a BSD-style license
*  that can be found in the LICENSE file in the root of the source
*  tree.
*/
/* eslint-env node */
                'use strict';

                Object.defineProperty(exports, "__esModule", {
                    value: true
                });

                var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function(obj) {
                    return typeof obj;
                } : function(obj) {
                    return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
                };

                exports.shimGetUserMedia = shimGetUserMedia;

                var _utils = require('../utils');

                var utils = _interopRequireWildcard(_utils);

                function _interopRequireWildcard(obj) {
                    if (obj && obj.__esModule) {
                        return obj;
                    } else {
                        var newObj = {};
                        if (obj != null) {
                            for (var key in obj) {
                                if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key];
                            }
                        }
                        newObj.default = obj;
                        return newObj;
                    }
                }

                function shimGetUserMedia(window) {
                    var browserDetails = utils.detectBrowser(window);
                    var navigator = window && window.navigator;
                    var MediaStreamTrack = window && window.MediaStreamTrack;

                    navigator.getUserMedia = function(constraints, onSuccess, onError) {
                        // Replace Firefox 44+'s deprecation warning with unprefixed version.
                        utils.deprecated('navigator.getUserMedia', 'navigator.mediaDevices.getUserMedia');
                        navigator.mediaDevices.getUserMedia(constraints).then(onSuccess, onError);
                    };

                    if (!(browserDetails.version > 55 && 'autoGainControl' in navigator.mediaDevices.getSupportedConstraints())) {
                        var remap = function remap(obj, a, b) {
                            if (a in obj && !(b in obj)) {
                                obj[b] = obj[a];
                                delete obj[a];
                            }
                        };

                        var nativeGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
                        navigator.mediaDevices.getUserMedia = function(c) {
                            if ((typeof c === 'undefined' ? 'undefined' : _typeof(c)) === 'object' && _typeof(c.audio) === 'object') {
                                c = JSON.parse(JSON.stringify(c));
                                remap(c.audio, 'autoGainControl', 'mozAutoGainControl');
                                remap(c.audio, 'noiseSuppression', 'mozNoiseSuppression');
                            }
                            return nativeGetUserMedia(c);
                        };

                        if (MediaStreamTrack && MediaStreamTrack.prototype.getSettings) {
                            var nativeGetSettings = MediaStreamTrack.prototype.getSettings;
                            MediaStreamTrack.prototype.getSettings = function() {
                                var obj = nativeGetSettings.apply(this, arguments);
                                remap(obj, 'mozAutoGainControl', 'autoGainControl');
                                remap(obj, 'mozNoiseSuppression', 'noiseSuppression');
                                return obj;
                            };
                        }

                        if (MediaStreamTrack && MediaStreamTrack.prototype.applyConstraints) {
                            var nativeApplyConstraints = MediaStreamTrack.prototype.applyConstraints;
                            MediaStreamTrack.prototype.applyConstraints = function(c) {
                                if (this.kind === 'audio' && (typeof c === 'undefined' ? 'undefined' : _typeof(c)) === 'object') {
                                    c = JSON.parse(JSON.stringify(c));
                                    remap(c, 'autoGainControl', 'mozAutoGainControl');
                                    remap(c, 'noiseSuppression', 'mozNoiseSuppression');
                                }
                                return nativeApplyConstraints.apply(this, [c]);
                            };
                        }
                    }
                }

            }, {
                "../utils": 15
            }],
            14: [function(require, module, exports) {
/*!
*  Copyright (c) 2016 The WebRTC project authors. All Rights Reserved.
*
*  Use of this source code is governed by a BSD-style license
*  that can be found in the LICENSE file in the root of the source
*  tree.
*/
                'use strict';

                Object.defineProperty(exports, "__esModule", {
                    value: true
                });

                var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function(obj) {
                    return typeof obj;
                } : function(obj) {
                    return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
                };

                exports.shimLocalStreamsAPI = shimLocalStreamsAPI;
                exports.shimRemoteStreamsAPI = shimRemoteStreamsAPI;
                exports.shimCallbacksAPI = shimCallbacksAPI;
                exports.shimGetUserMedia = shimGetUserMedia;
                exports.shimConstraints = shimConstraints;
                exports.shimRTCIceServerUrls = shimRTCIceServerUrls;
                exports.shimTrackEventTransceiver = shimTrackEventTransceiver;
                exports.shimCreateOfferLegacy = shimCreateOfferLegacy;
                exports.shimAudioContext = shimAudioContext;

                var _utils = require('../utils');

                var utils = _interopRequireWildcard(_utils);

                function _interopRequireWildcard(obj) {
                    if (obj && obj.__esModule) {
                        return obj;
                    } else {
                        var newObj = {};
                        if (obj != null) {
                            for (var key in obj) {
                                if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key];
                            }
                        }
                        newObj.default = obj;
                        return newObj;
                    }
                }

                function shimLocalStreamsAPI(window) {
                    if ((typeof window === 'undefined' ? 'undefined' : _typeof(window)) !== 'object' || !window.RTCPeerConnection) {
                        return;
                    }
                    if (!('getLocalStreams' in window.RTCPeerConnection.prototype)) {
                        window.RTCPeerConnection.prototype.getLocalStreams = function getLocalStreams() {
                            if (!this._localStreams) {
                                this._localStreams = [];
                            }
                            return this._localStreams;
                        };
                    }
                    if (!('addStream' in window.RTCPeerConnection.prototype)) {
                        var _addTrack = window.RTCPeerConnection.prototype.addTrack;
                        window.RTCPeerConnection.prototype.addStream = function addStream(stream) {
                            var _this = this;

                            if (!this._localStreams) {
                                this._localStreams = [];
                            }
                            if (!this._localStreams.includes(stream)) {
                                this._localStreams.push(stream);
                            }
                            // Try to emulate Chrome's behaviour of adding in audio-video order.
                            // Safari orders by track id.
                            stream.getAudioTracks().forEach(function(track) {
                                return _addTrack.call(_this, track, stream);
                            });
                            stream.getVideoTracks().forEach(function(track) {
                                return _addTrack.call(_this, track, stream);
                            });
                        };

                        window.RTCPeerConnection.prototype.addTrack = function addTrack(track) {
                            var _this2 = this;

                            for (var _len = arguments.length, streams = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
                                streams[_key - 1] = arguments[_key];
                            }

                            if (streams) {
                                streams.forEach(function(stream) {
                                    if (!_this2._localStreams) {
                                        _this2._localStreams = [stream];
                                    } else if (!_this2._localStreams.includes(stream)) {
                                        _this2._localStreams.push(stream);
                                    }
                                });
                            }
                            return _addTrack.apply(this, arguments);
                        };
                    }
                    if (!('removeStream' in window.RTCPeerConnection.prototype)) {
                        window.RTCPeerConnection.prototype.removeStream = function removeStream(stream) {
                            var _this3 = this;

                            if (!this._localStreams) {
                                this._localStreams = [];
                            }
                            var index = this._localStreams.indexOf(stream);
                            if (index === -1) {
                                return;
                            }
                            this._localStreams.splice(index, 1);
                            var tracks = stream.getTracks();
                            this.getSenders().forEach(function(sender) {
                                if (tracks.includes(sender.track)) {
                                    _this3.removeTrack(sender);
                                }
                            });
                        };
                    }
                }

                function shimRemoteStreamsAPI(window) {
                    if ((typeof window === 'undefined' ? 'undefined' : _typeof(window)) !== 'object' || !window.RTCPeerConnection) {
                        return;
                    }
                    if (!('getRemoteStreams' in window.RTCPeerConnection.prototype)) {
                        window.RTCPeerConnection.prototype.getRemoteStreams = function getRemoteStreams() {
                            return this._remoteStreams ? this._remoteStreams : [];
                        };
                    }
                    if (!('onaddstream' in window.RTCPeerConnection.prototype)) {
                        Object.defineProperty(window.RTCPeerConnection.prototype, 'onaddstream', {
                            get: function get() {
                                return this._onaddstream;
                            },
                            set: function set(f) {
                                var _this4 = this;

                                if (this._onaddstream) {
                                    this.removeEventListener('addstream', this._onaddstream);
                                    this.removeEventListener('track', this._onaddstreampoly);
                                }
                                this.addEventListener('addstream', this._onaddstream = f);
                                this.addEventListener('track', this._onaddstreampoly = function(e) {
                                    e.streams.forEach(function(stream) {
                                        if (!_this4._remoteStreams) {
                                            _this4._remoteStreams = [];
                                        }
                                        if (_this4._remoteStreams.includes(stream)) {
                                            return;
                                        }
                                        _this4._remoteStreams.push(stream);
                                        var event = new Event('addstream');
                                        event.stream = stream;
                                        _this4.dispatchEvent(event);
                                    });
                                });
                            }
                        });
                        var origSetRemoteDescription = window.RTCPeerConnection.prototype.setRemoteDescription;
                        window.RTCPeerConnection.prototype.setRemoteDescription = function setRemoteDescription() {
                            var pc = this;
                            if (!this._onaddstreampoly) {
                                this.addEventListener('track', this._onaddstreampoly = function(e) {
                                    e.streams.forEach(function(stream) {
                                        if (!pc._remoteStreams) {
                                            pc._remoteStreams = [];
                                        }
                                        if (pc._remoteStreams.indexOf(stream) >= 0) {
                                            return;
                                        }
                                        pc._remoteStreams.push(stream);
                                        var event = new Event('addstream');
                                        event.stream = stream;
                                        pc.dispatchEvent(event);
                                    });
                                });
                            }
                            return origSetRemoteDescription.apply(pc, arguments);
                        };
                    }
                }

                function shimCallbacksAPI(window) {
                    if ((typeof window === 'undefined' ? 'undefined' : _typeof(window)) !== 'object' || !window.RTCPeerConnection) {
                        return;
                    }
                    var prototype = window.RTCPeerConnection.prototype;
                    var origCreateOffer = prototype.createOffer;
                    var origCreateAnswer = prototype.createAnswer;
                    var setLocalDescription = prototype.setLocalDescription;
                    var setRemoteDescription = prototype.setRemoteDescription;
                    var addIceCandidate = prototype.addIceCandidate;

                    prototype.createOffer = function createOffer(successCallback, failureCallback) {
                        var options = arguments.length >= 2 ? arguments[2] : arguments[0];
                        var promise = origCreateOffer.apply(this, [options]);
                        if (!failureCallback) {
                            return promise;
                        }
                        promise.then(successCallback, failureCallback);
                        return Promise.resolve();
                    };

                    prototype.createAnswer = function createAnswer(successCallback, failureCallback) {
                        var options = arguments.length >= 2 ? arguments[2] : arguments[0];
                        var promise = origCreateAnswer.apply(this, [options]);
                        if (!failureCallback) {
                            return promise;
                        }
                        promise.then(successCallback, failureCallback);
                        return Promise.resolve();
                    };

                    var withCallback = function withCallback(description, successCallback, failureCallback) {
                        var promise = setLocalDescription.apply(this, [description]);
                        if (!failureCallback) {
                            return promise;
                        }
                        promise.then(successCallback, failureCallback);
                        return Promise.resolve();
                    };
                    prototype.setLocalDescription = withCallback;

                    withCallback = function withCallback(description, successCallback, failureCallback) {
                        var promise = setRemoteDescription.apply(this, [description]);
                        if (!failureCallback) {
                            return promise;
                        }
                        promise.then(successCallback, failureCallback);
                        return Promise.resolve();
                    };
                    prototype.setRemoteDescription = withCallback;

                    withCallback = function withCallback(candidate, successCallback, failureCallback) {
                        var promise = addIceCandidate.apply(this, [candidate]);
                        if (!failureCallback) {
                            return promise;
                        }
                        promise.then(successCallback, failureCallback);
                        return Promise.resolve();
                    };
                    prototype.addIceCandidate = withCallback;
                }

                function shimGetUserMedia(window) {
                    var navigator = window && window.navigator;

                    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                        // shim not needed in Safari 12.1
                        var mediaDevices = navigator.mediaDevices;
                        var _getUserMedia = mediaDevices.getUserMedia.bind(mediaDevices);
                        navigator.mediaDevices.getUserMedia = function(constraints) {
                            return _getUserMedia(shimConstraints(constraints));
                        };
                    }

                    if (!navigator.getUserMedia && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                        navigator.getUserMedia = function getUserMedia(constraints, cb, errcb) {
                            navigator.mediaDevices.getUserMedia(constraints).then(cb, errcb);
                        }.bind(navigator);
                    }
                }

                function shimConstraints(constraints) {
                    if (constraints && constraints.video !== undefined) {
                        return Object.assign({}, constraints, {
                            video: utils.compactObject(constraints.video)
                        });
                    }

                    return constraints;
                }

                function shimRTCIceServerUrls(window) {
                    // migrate from non-spec RTCIceServer.url to RTCIceServer.urls
                    var OrigPeerConnection = window.RTCPeerConnection;
                    window.RTCPeerConnection = function RTCPeerConnection(pcConfig, pcConstraints) {
                        if (pcConfig && pcConfig.iceServers) {
                            var newIceServers = [];
                            for (var i = 0; i < pcConfig.iceServers.length; i++) {
                                var server = pcConfig.iceServers[i];
                                if (!server.hasOwnProperty('urls') && server.hasOwnProperty('url')) {
                                    utils.deprecated('RTCIceServer.url', 'RTCIceServer.urls');
                                    server = JSON.parse(JSON.stringify(server));
                                    server.urls = server.url;
                                    delete server.url;
                                    newIceServers.push(server);
                                } else {
                                    newIceServers.push(pcConfig.iceServers[i]);
                                }
                            }
                            pcConfig.iceServers = newIceServers;
                        }
                        return new OrigPeerConnection(pcConfig, pcConstraints);
                    };
                    window.RTCPeerConnection.prototype = OrigPeerConnection.prototype;
                    // wrap static methods. Currently just generateCertificate.
                    if ('generateCertificate' in window.RTCPeerConnection) {
                        Object.defineProperty(window.RTCPeerConnection, 'generateCertificate', {
                            get: function get() {
                                return OrigPeerConnection.generateCertificate;
                            }
                        });
                    }
                }

                function shimTrackEventTransceiver(window) {
                    // Add event.transceiver member over deprecated event.receiver
                    if ((typeof window === 'undefined' ? 'undefined' : _typeof(window)) === 'object' && window.RTCTrackEvent && 'receiver' in window.RTCTrackEvent.prototype && !('transceiver' in window.RTCTrackEvent.prototype)) {
                        Object.defineProperty(window.RTCTrackEvent.prototype, 'transceiver', {
                            get: function get() {
                                return {
                                    receiver: this.receiver
                                };
                            }
                        });
                    }
                }

                function shimCreateOfferLegacy(window) {
                    var origCreateOffer = window.RTCPeerConnection.prototype.createOffer;
                    window.RTCPeerConnection.prototype.createOffer = function createOffer(offerOptions) {
                        if (offerOptions) {
                            if (typeof offerOptions.offerToReceiveAudio !== 'undefined') {
                                // support bit values
                                offerOptions.offerToReceiveAudio = !!offerOptions.offerToReceiveAudio;
                            }
                            var audioTransceiver = this.getTransceivers().find(function(transceiver) {
                                return transceiver.receiver.track.kind === 'audio';
                            });
                            if (offerOptions.offerToReceiveAudio === false && audioTransceiver) {
                                if (audioTransceiver.direction === 'sendrecv') {
                                    if (audioTransceiver.setDirection) {
                                        audioTransceiver.setDirection('sendonly');
                                    } else {
                                        audioTransceiver.direction = 'sendonly';
                                    }
                                } else if (audioTransceiver.direction === 'recvonly') {
                                    if (audioTransceiver.setDirection) {
                                        audioTransceiver.setDirection('inactive');
                                    } else {
                                        audioTransceiver.direction = 'inactive';
                                    }
                                }
                            } else if (offerOptions.offerToReceiveAudio === true && !audioTransceiver) {
                                this.addTransceiver('audio');
                            }

                            if (typeof offerOptions.offerToReceiveVideo !== 'undefined') {
                                // support bit values
                                offerOptions.offerToReceiveVideo = !!offerOptions.offerToReceiveVideo;
                            }
                            var videoTransceiver = this.getTransceivers().find(function(transceiver) {
                                return transceiver.receiver.track.kind === 'video';
                            });
                            if (offerOptions.offerToReceiveVideo === false && videoTransceiver) {
                                if (videoTransceiver.direction === 'sendrecv') {
                                    if (videoTransceiver.setDirection) {
                                        videoTransceiver.setDirection('sendonly');
                                    } else {
                                        videoTransceiver.direction = 'sendonly';
                                    }
                                } else if (videoTransceiver.direction === 'recvonly') {
                                    if (videoTransceiver.setDirection) {
                                        videoTransceiver.setDirection('inactive');
                                    } else {
                                        videoTransceiver.direction = 'inactive';
                                    }
                                }
                            } else if (offerOptions.offerToReceiveVideo === true && !videoTransceiver) {
                                this.addTransceiver('video');
                            }
                        }
                        return origCreateOffer.apply(this, arguments);
                    };
                }

                function shimAudioContext(window) {
                    if ((typeof window === 'undefined' ? 'undefined' : _typeof(window)) !== 'object' || window.AudioContext) {
                        return;
                    }
                    window.AudioContext = window.webkitAudioContext;
                }

            }, {
                "../utils": 15
            }],
            15: [function(require, module, exports) {
/*!
*  Copyright (c) 2016 The WebRTC project authors. All Rights Reserved.
*
*  Use of this source code is governed by a BSD-style license
*  that can be found in the LICENSE file in the root of the source
*  tree.
*/
/* eslint-env node */
                'use strict';

                Object.defineProperty(exports, "__esModule", {
                    value: true
                });

                var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function(obj) {
                    return typeof obj;
                } : function(obj) {
                    return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
                };

                exports.extractVersion = extractVersion;
                exports.wrapPeerConnectionEvent = wrapPeerConnectionEvent;
                exports.disableLog = disableLog;
                exports.disableWarnings = disableWarnings;
                exports.log = log;
                exports.deprecated = deprecated;
                exports.detectBrowser = detectBrowser;
                exports.compactObject = compactObject;
                exports.walkStats = walkStats;
                exports.filterStats = filterStats;

                function _defineProperty(obj, key, value) {
                    if (key in obj) {
                        Object.defineProperty(obj, key, {
                            value: value,
                            enumerable: true,
                            configurable: true,
                            writable: true
                        });
                    } else {
                        obj[key] = value;
                    }
                    return obj;
                }

                var logDisabled_ = true;
                var deprecationWarnings_ = true;

                /**
                 * Extract browser version out of the provided user agent string.
                 *
                 * @param {!string} uastring userAgent string.
                 * @param {!string} expr Regular expression used as match criteria.
                 * @param {!number} pos position in the version string to be returned.
                 * @return {!number} browser version.
                 */
                function extractVersion(uastring, expr, pos) {
                    var match = uastring.match(expr);
                    return match && match.length >= pos && parseInt(match[pos], 10);
                }

                // Wraps the peerconnection event eventNameToWrap in a function
                // which returns the modified event object (or false to prevent
                // the event).
                function wrapPeerConnectionEvent(window, eventNameToWrap, wrapper) {
                    if (!window.RTCPeerConnection) {
                        return;
                    }
                    var proto = window.RTCPeerConnection.prototype;
                    var nativeAddEventListener = proto.addEventListener;
                    proto.addEventListener = function(nativeEventName, cb) {
                        if (nativeEventName !== eventNameToWrap) {
                            return nativeAddEventListener.apply(this, arguments);
                        }
                        var wrappedCallback = function wrappedCallback(e) {
                            var modifiedEvent = wrapper(e);
                            if (modifiedEvent) {
                                cb(modifiedEvent);
                            }
                        };
                        this._eventMap = this._eventMap || {};
                        this._eventMap[cb] = wrappedCallback;
                        return nativeAddEventListener.apply(this, [nativeEventName, wrappedCallback]);
                    };

                    var nativeRemoveEventListener = proto.removeEventListener;
                    proto.removeEventListener = function(nativeEventName, cb) {
                        if (nativeEventName !== eventNameToWrap || !this._eventMap || !this._eventMap[cb]) {
                            return nativeRemoveEventListener.apply(this, arguments);
                        }
                        var unwrappedCb = this._eventMap[cb];
                        delete this._eventMap[cb];
                        return nativeRemoveEventListener.apply(this, [nativeEventName, unwrappedCb]);
                    };

                    Object.defineProperty(proto, 'on' + eventNameToWrap, {
                        get: function get() {
                            return this['_on' + eventNameToWrap];
                        },
                        set: function set(cb) {
                            if (this['_on' + eventNameToWrap]) {
                                this.removeEventListener(eventNameToWrap, this['_on' + eventNameToWrap]);
                                delete this['_on' + eventNameToWrap];
                            }
                            if (cb) {
                                this.addEventListener(eventNameToWrap, this['_on' + eventNameToWrap] = cb);
                            }
                        },

                        enumerable: true,
                        configurable: true
                    });
                }

                function disableLog(bool) {
                    if (typeof bool !== 'boolean') {
                        return new Error('Argument type: ' + (typeof bool === 'undefined' ? 'undefined' : _typeof(bool)) + '. Please use a boolean.');
                    }
                    logDisabled_ = bool;
                    return bool ? 'adapter.js logging disabled' : 'adapter.js logging enabled';
                }

                /**
                 * Disable or enable deprecation warnings
                 * @param {!boolean} bool set to true to disable warnings.
                 */
                function disableWarnings(bool) {
                    if (typeof bool !== 'boolean') {
                        return new Error('Argument type: ' + (typeof bool === 'undefined' ? 'undefined' : _typeof(bool)) + '. Please use a boolean.');
                    }
                    deprecationWarnings_ = !bool;
                    return 'adapter.js deprecation warnings ' + (bool ? 'disabled' : 'enabled');
                }

                function log() {
                    if ((typeof window === 'undefined' ? 'undefined' : _typeof(window)) === 'object') {
                        if (logDisabled_) {
                            return;
                        }
                        if (typeof console !== 'undefined' && typeof console.log === 'function') {
                            console.log.apply(console, arguments);
                        }
                    }
                }

                /**
                 * Shows a deprecation warning suggesting the modern and spec-compatible API.
                 */
                function deprecated(oldMethod, newMethod) {
                    if (!deprecationWarnings_) {
                        return;
                    }
                    console.warn(oldMethod + ' is deprecated, please use ' + newMethod + ' instead.');
                }

                /**
                 * Browser detector.
                 *
                 * @return {object} result containing browser and version
                 *     properties.
                 */
                function detectBrowser(window) {
                    var navigator = window.navigator;

                    // Returned result object.

                    var result = {
                        browser: null,
                        version: null
                    };

                    // Fail early if it's not a browser
                    if (typeof window === 'undefined' || !window.navigator) {
                        result.browser = 'Not a browser.';
                        return result;
                    }

                    if (navigator.mozGetUserMedia) {
                        // Firefox.
                        result.browser = 'firefox';
                        result.version = extractVersion(navigator.userAgent, /Firefox\/(\d+)\./, 1);
                    } else if (navigator.webkitGetUserMedia || window.isSecureContext === false && window.webkitRTCPeerConnection && !window.RTCIceGatherer) {
                        // Chrome, Chromium, Webview, Opera.
                        // Version matches Chrome/WebRTC version.
                        // Chrome 74 removed webkitGetUserMedia on http as well so we need the
                        // more complicated fallback to webkitRTCPeerConnection.
                        result.browser = 'chrome';
                        result.version = extractVersion(navigator.userAgent, /Chrom(e|ium)\/(\d+)\./, 2);
                    } else if (navigator.mediaDevices && navigator.userAgent.match(/Edge\/(\d+).(\d+)$/)) {
                        // Edge.
                        result.browser = 'edge';
                        result.version = extractVersion(navigator.userAgent, /Edge\/(\d+).(\d+)$/, 2);
                    } else if (window.RTCPeerConnection && navigator.userAgent.match(/AppleWebKit\/(\d+)\./)) {
                        // Safari.
                        result.browser = 'safari';
                        result.version = extractVersion(navigator.userAgent, /AppleWebKit\/(\d+)\./, 1);
                        result.supportsUnifiedPlan = window.RTCRtpTransceiver && 'currentDirection' in window.RTCRtpTransceiver.prototype;
                    } else {
                        // Default fallthrough: not supported.
                        result.browser = 'Not a supported browser.';
                        return result;
                    }

                    return result;
                }

                /**
                 * Checks if something is an object.
                 *
                 * @param {*} val The something you want to check.
                 * @return true if val is an object, false otherwise.
                 */
                function isObject(val) {
                    return Object.prototype.toString.call(val) === '[object Object]';
                }

                /**
                 * Remove all empty objects and undefined values
                 * from a nested object -- an enhanced and vanilla version
                 * of Lodash's `compact`.
                 */
                function compactObject(data) {
                    if (!isObject(data)) {
                        return data;
                    }

                    return Object.keys(data).reduce(function(accumulator, key) {
                        var isObj = isObject(data[key]);
                        var value = isObj ? compactObject(data[key]) : data[key];
                        var isEmptyObject = isObj && !Object.keys(value).length;
                        if (value === undefined || isEmptyObject) {
                            return accumulator;
                        }
                        return Object.assign(accumulator, _defineProperty({}, key, value));
                    }, {});
                }

                /* iterates the stats graph recursively. */
                function walkStats(stats, base, resultSet) {
                    if (!base || resultSet.has(base.id)) {
                        return;
                    }
                    resultSet.set(base.id, base);
                    Object.keys(base).forEach(function(name) {
                        if (name.endsWith('Id')) {
                            walkStats(stats, stats.get(base[name]), resultSet);
                        } else if (name.endsWith('Ids')) {
                            base[name].forEach(function(id) {
                                walkStats(stats, stats.get(id), resultSet);
                            });
                        }
                    });
                }

                /* filter getStats for a sender/receiver track. */
                function filterStats(result, track, outbound) {
                    var streamStatsType = outbound ? 'outbound-rtp' : 'inbound-rtp';
                    var filteredResult = new Map();
                    if (track === null) {
                        return filteredResult;
                    }
                    var trackStats = [];
                    result.forEach(function(value) {
                        if (value.type === 'track' && value.trackIdentifier === track.id) {
                            trackStats.push(value);
                        }
                    });
                    trackStats.forEach(function(trackStat) {
                        result.forEach(function(stats) {
                            if (stats.type === streamStatsType && stats.trackId === trackStat.id) {
                                walkStats(result, stats, filteredResult);
                            }
                        });
                    });
                    return filteredResult;
                }

            }, {}],
            16: [function(require, module, exports) {
/*!
*  Copyright (c) 2017 The WebRTC project authors. All Rights Reserved.
*
*  Use of this source code is governed by a BSD-style license
*  that can be found in the LICENSE file in the root of the source
*  tree.
*/
/* eslint-env node */
                'use strict';

                var SDPUtils = require('sdp');

                function fixStatsType(stat) {
                    return {
                        inboundrtp: 'inbound-rtp',
                        outboundrtp: 'outbound-rtp',
                        candidatepair: 'candidate-pair',
                        localcandidate: 'local-candidate',
                        remotecandidate: 'remote-candidate'
                    } [stat.type] || stat.type;
                }

                function writeMediaSection(transceiver, caps, type, stream, dtlsRole) {
                    var sdp = SDPUtils.writeRtpDescription(transceiver.kind, caps);

                    // Map ICE parameters (ufrag, pwd) to SDP.
                    sdp += SDPUtils.writeIceParameters(
                        transceiver.iceGatherer.getLocalParameters());

                    // Map DTLS parameters to SDP.
                    sdp += SDPUtils.writeDtlsParameters(
                        transceiver.dtlsTransport.getLocalParameters(),
                        type === 'offer' ? 'actpass' : dtlsRole || 'active');

                    sdp += 'a=mid:' + transceiver.mid + '\r\n';

                    if (transceiver.rtpSender && transceiver.rtpReceiver) {
                        sdp += 'a=sendrecv\r\n';
                    } else if (transceiver.rtpSender) {
                        sdp += 'a=sendonly\r\n';
                    } else if (transceiver.rtpReceiver) {
                        sdp += 'a=recvonly\r\n';
                    } else {
                        sdp += 'a=inactive\r\n';
                    }

                    if (transceiver.rtpSender) {
                        var trackId = transceiver.rtpSender._initialTrackId ||
                            transceiver.rtpSender.track.id;
                        transceiver.rtpSender._initialTrackId = trackId;
                        // spec.
                        var msid = 'msid:' + (stream ? stream.id : '-') + ' ' +
                            trackId + '\r\n';
                        sdp += 'a=' + msid;
                        // for Chrome. Legacy should no longer be required.
                        sdp += 'a=ssrc:' + transceiver.sendEncodingParameters[0].ssrc +
                            ' ' + msid;

                        // RTX
                        if (transceiver.sendEncodingParameters[0].rtx) {
                            sdp += 'a=ssrc:' + transceiver.sendEncodingParameters[0].rtx.ssrc +
                                ' ' + msid;
                            sdp += 'a=ssrc-group:FID ' +
                                transceiver.sendEncodingParameters[0].ssrc + ' ' +
                                transceiver.sendEncodingParameters[0].rtx.ssrc +
                                '\r\n';
                        }
                    }
                    // FIXME: this should be written by writeRtpDescription.
                    sdp += 'a=ssrc:' + transceiver.sendEncodingParameters[0].ssrc +
                        ' cname:' + SDPUtils.localCName + '\r\n';
                    if (transceiver.rtpSender && transceiver.sendEncodingParameters[0].rtx) {
                        sdp += 'a=ssrc:' + transceiver.sendEncodingParameters[0].rtx.ssrc +
                            ' cname:' + SDPUtils.localCName + '\r\n';
                    }
                    return sdp;
                }

                // Edge does not like
                // 1) stun: filtered after 14393 unless ?transport=udp is present
                // 2) turn: that does not have all of turn:host:port?transport=udp
                // 3) turn: with ipv6 addresses
                // 4) turn: occurring muliple times
                function filterIceServers(iceServers, edgeVersion) {
                    var hasTurn = false;
                    iceServers = JSON.parse(JSON.stringify(iceServers));
                    return iceServers.filter(function(server) {
                        if (server && (server.urls || server.url)) {
                            var urls = server.urls || server.url;
                            if (server.url && !server.urls) {
                                console.warn('RTCIceServer.url is deprecated! Use urls instead.');
                            }
                            var isString = typeof urls === 'string';
                            if (isString) {
                                urls = [urls];
                            }
                            urls = urls.filter(function(url) {
                                var validTurn = url.indexOf('turn:') === 0 &&
                                    url.indexOf('transport=udp') !== -1 &&
                                    url.indexOf('turn:[') === -1 &&
                                    !hasTurn;

                                if (validTurn) {
                                    hasTurn = true;
                                    return true;
                                }
                                return url.indexOf('stun:') === 0 && edgeVersion >= 14393 &&
                                    url.indexOf('?transport=udp') === -1;
                            });

                            delete server.url;
                            server.urls = isString ? urls[0] : urls;
                            return !!urls.length;
                        }
                    });
                }

                // Determines the intersection of local and remote capabilities.
                function getCommonCapabilities(localCapabilities, remoteCapabilities) {
                    var commonCapabilities = {
                        codecs: [],
                        headerExtensions: [],
                        fecMechanisms: []
                    };

                    var findCodecByPayloadType = function(pt, codecs) {
                        pt = parseInt(pt, 10);
                        for (var i = 0; i < codecs.length; i++) {
                            if (codecs[i].payloadType === pt ||
                                codecs[i].preferredPayloadType === pt) {
                                return codecs[i];
                            }
                        }
                    };

                    var rtxCapabilityMatches = function(lRtx, rRtx, lCodecs, rCodecs) {
                        var lCodec = findCodecByPayloadType(lRtx.parameters.apt, lCodecs);
                        var rCodec = findCodecByPayloadType(rRtx.parameters.apt, rCodecs);
                        return lCodec && rCodec &&
                            lCodec.name.toLowerCase() === rCodec.name.toLowerCase();
                    };

                    localCapabilities.codecs.forEach(function(lCodec) {
                        for (var i = 0; i < remoteCapabilities.codecs.length; i++) {
                            var rCodec = remoteCapabilities.codecs[i];
                            if (lCodec.name.toLowerCase() === rCodec.name.toLowerCase() &&
                                lCodec.clockRate === rCodec.clockRate) {
                                if (lCodec.name.toLowerCase() === 'rtx' &&
                                    lCodec.parameters && rCodec.parameters.apt) {
                                    // for RTX we need to find the local rtx that has a apt
                                    // which points to the same local codec as the remote one.
                                    if (!rtxCapabilityMatches(lCodec, rCodec,
                                            localCapabilities.codecs, remoteCapabilities.codecs)) {
                                        continue;
                                    }
                                }
                                rCodec = JSON.parse(JSON.stringify(rCodec)); // deepcopy
                                // number of channels is the highest common number of channels
                                rCodec.numChannels = Math.min(lCodec.numChannels,
                                    rCodec.numChannels);
                                // push rCodec so we reply with offerer payload type
                                commonCapabilities.codecs.push(rCodec);

                                // determine common feedback mechanisms
                                rCodec.rtcpFeedback = rCodec.rtcpFeedback.filter(function(fb) {
                                    for (var j = 0; j < lCodec.rtcpFeedback.length; j++) {
                                        if (lCodec.rtcpFeedback[j].type === fb.type &&
                                            lCodec.rtcpFeedback[j].parameter === fb.parameter) {
                                            return true;
                                        }
                                    }
                                    return false;
                                });
                                // FIXME: also need to determine .parameters
                                //  see https://github.com/openpeer/ortc/issues/569
                                break;
                            }
                        }
                    });

                    localCapabilities.headerExtensions.forEach(function(lHeaderExtension) {
                        for (var i = 0; i < remoteCapabilities.headerExtensions.length; i++) {
                            var rHeaderExtension = remoteCapabilities.headerExtensions[i];
                            if (lHeaderExtension.uri === rHeaderExtension.uri) {
                                commonCapabilities.headerExtensions.push(rHeaderExtension);
                                break;
                            }
                        }
                    });

                    // FIXME: fecMechanisms
                    return commonCapabilities;
                }

                // is action=setLocalDescription with type allowed in signalingState
                function isActionAllowedInSignalingState(action, type, signalingState) {
                    return {
                        offer: {
                            setLocalDescription: ['stable', 'have-local-offer'],
                            setRemoteDescription: ['stable', 'have-remote-offer']
                        },
                        answer: {
                            setLocalDescription: ['have-remote-offer', 'have-local-pranswer'],
                            setRemoteDescription: ['have-local-offer', 'have-remote-pranswer']
                        }
                    } [type][action].indexOf(signalingState) !== -1;
                }

                function maybeAddCandidate(iceTransport, candidate) {
                    // Edge's internal representation adds some fields therefore
                    // not all fieldѕ are taken into account.
                    var alreadyAdded = iceTransport.getRemoteCandidates()
                        .find(function(remoteCandidate) {
                            return candidate.foundation === remoteCandidate.foundation &&
                                candidate.ip === remoteCandidate.ip &&
                                candidate.port === remoteCandidate.port &&
                                candidate.priority === remoteCandidate.priority &&
                                candidate.protocol === remoteCandidate.protocol &&
                                candidate.type === remoteCandidate.type;
                        });
                    if (!alreadyAdded) {
                        iceTransport.addRemoteCandidate(candidate);
                    }
                    return !alreadyAdded;
                }


                function makeError(name, description) {
                    var e = new Error(description);
                    e.name = name;
                    // legacy error codes from https://heycam.github.io/webidl/#idl-DOMException-error-names
                    e.code = {
                        NotSupportedError: 9,
                        InvalidStateError: 11,
                        InvalidAccessError: 15,
                        TypeError: undefined,
                        OperationError: undefined
                    } [name];
                    return e;
                }

                module.exports = function(window, edgeVersion) {
                    // https://w3c.github.io/mediacapture-main/#mediastream
                    // Helper function to add the track to the stream and
                    // dispatch the event ourselves.
                    function addTrackToStreamAndFireEvent(track, stream) {
                        stream.addTrack(track);
                        stream.dispatchEvent(new window.MediaStreamTrackEvent('addtrack', {
                            track: track
                        }));
                    }

                    function removeTrackFromStreamAndFireEvent(track, stream) {
                        stream.removeTrack(track);
                        stream.dispatchEvent(new window.MediaStreamTrackEvent('removetrack', {
                            track: track
                        }));
                    }

                    function fireAddTrack(pc, track, receiver, streams) {
                        var trackEvent = new Event('track');
                        trackEvent.track = track;
                        trackEvent.receiver = receiver;
                        trackEvent.transceiver = {
                            receiver: receiver
                        };
                        trackEvent.streams = streams;
                        window.setTimeout(function() {
                            pc._dispatchEvent('track', trackEvent);
                        });
                    }

                    var RTCPeerConnection = function(config) {
                        var pc = this;

                        var _eventTarget = document.createDocumentFragment();
                        ['addEventListener', 'removeEventListener', 'dispatchEvent']
                        .forEach(function(method) {
                            pc[method] = _eventTarget[method].bind(_eventTarget);
                        });

                        this.canTrickleIceCandidates = null;

                        this.needNegotiation = false;

                        this.localStreams = [];
                        this.remoteStreams = [];

                        this._localDescription = null;
                        this._remoteDescription = null;

                        this.signalingState = 'stable';
                        this.iceConnectionState = 'new';
                        this.connectionState = 'new';
                        this.iceGatheringState = 'new';

                        config = JSON.parse(JSON.stringify(config || {}));

                        this.usingBundle = config.bundlePolicy === 'max-bundle';
                        if (config.rtcpMuxPolicy === 'negotiate') {
                            throw (makeError('NotSupportedError',
                                'rtcpMuxPolicy \'negotiate\' is not supported'));
                        } else if (!config.rtcpMuxPolicy) {
                            config.rtcpMuxPolicy = 'require';
                        }

                        switch (config.iceTransportPolicy) {
                            case 'all':
                            case 'relay':
                                break;
                            default:
                                config.iceTransportPolicy = 'all';
                                break;
                        }

                        switch (config.bundlePolicy) {
                            case 'balanced':
                            case 'max-compat':
                            case 'max-bundle':
                                break;
                            default:
                                config.bundlePolicy = 'balanced';
                                break;
                        }

                        config.iceServers = filterIceServers(config.iceServers || [], edgeVersion);

                        this._iceGatherers = [];
                        if (config.iceCandidatePoolSize) {
                            for (var i = config.iceCandidatePoolSize; i > 0; i--) {
                                this._iceGatherers.push(new window.RTCIceGatherer({
                                    iceServers: config.iceServers,
                                    gatherPolicy: config.iceTransportPolicy
                                }));
                            }
                        } else {
                            config.iceCandidatePoolSize = 0;
                        }

                        this._config = config;

                        // per-track iceGathers, iceTransports, dtlsTransports, rtpSenders, ...
                        // everything that is needed to describe a SDP m-line.
                        this.transceivers = [];

                        this._sdpSessionId = SDPUtils.generateSessionId();
                        this._sdpSessionVersion = 0;

                        this._dtlsRole = undefined; // role for a=setup to use in answers.

                        this._isClosed = false;
                    };

                    Object.defineProperty(RTCPeerConnection.prototype, 'localDescription', {
                        configurable: true,
                        get: function() {
                            return this._localDescription;
                        }
                    });
                    Object.defineProperty(RTCPeerConnection.prototype, 'remoteDescription', {
                        configurable: true,
                        get: function() {
                            return this._remoteDescription;
                        }
                    });

                    // set up event handlers on prototype
                    RTCPeerConnection.prototype.onicecandidate = null;
                    RTCPeerConnection.prototype.onaddstream = null;
                    RTCPeerConnection.prototype.ontrack = null;
                    RTCPeerConnection.prototype.onremovestream = null;
                    RTCPeerConnection.prototype.onsignalingstatechange = null;
                    RTCPeerConnection.prototype.oniceconnectionstatechange = null;
                    RTCPeerConnection.prototype.onconnectionstatechange = null;
                    RTCPeerConnection.prototype.onicegatheringstatechange = null;
                    RTCPeerConnection.prototype.onnegotiationneeded = null;
                    RTCPeerConnection.prototype.ondatachannel = null;

                    RTCPeerConnection.prototype._dispatchEvent = function(name, event) {
                        if (this._isClosed) {
                            return;
                        }
                        this.dispatchEvent(event);
                        if (typeof this['on' + name] === 'function') {
                            this['on' + name](event);
                        }
                    };

                    RTCPeerConnection.prototype._emitGatheringStateChange = function() {
                        var event = new Event('icegatheringstatechange');
                        this._dispatchEvent('icegatheringstatechange', event);
                    };

                    RTCPeerConnection.prototype.getConfiguration = function() {
                        return this._config;
                    };

                    RTCPeerConnection.prototype.getLocalStreams = function() {
                        return this.localStreams;
                    };

                    RTCPeerConnection.prototype.getRemoteStreams = function() {
                        return this.remoteStreams;
                    };

                    // internal helper to create a transceiver object.
                    // (which is not yet the same as the WebRTC 1.0 transceiver)
                    RTCPeerConnection.prototype._createTransceiver = function(kind, doNotAdd) {
                        var hasBundleTransport = this.transceivers.length > 0;
                        var transceiver = {
                            track: null,
                            iceGatherer: null,
                            iceTransport: null,
                            dtlsTransport: null,
                            localCapabilities: null,
                            remoteCapabilities: null,
                            rtpSender: null,
                            rtpReceiver: null,
                            kind: kind,
                            mid: null,
                            sendEncodingParameters: null,
                            recvEncodingParameters: null,
                            stream: null,
                            associatedRemoteMediaStreams: [],
                            wantReceive: true
                        };
                        if (this.usingBundle && hasBundleTransport) {
                            transceiver.iceTransport = this.transceivers[0].iceTransport;
                            transceiver.dtlsTransport = this.transceivers[0].dtlsTransport;
                        } else {
                            var transports = this._createIceAndDtlsTransports();
                            transceiver.iceTransport = transports.iceTransport;
                            transceiver.dtlsTransport = transports.dtlsTransport;
                        }
                        if (!doNotAdd) {
                            this.transceivers.push(transceiver);
                        }
                        return transceiver;
                    };

                    RTCPeerConnection.prototype.addTrack = function(track, stream) {
                        if (this._isClosed) {
                            throw makeError('InvalidStateError',
                                'Attempted to call addTrack on a closed peerconnection.');
                        }

                        var alreadyExists = this.transceivers.find(function(s) {
                            return s.track === track;
                        });

                        if (alreadyExists) {
                            throw makeError('InvalidAccessError', 'Track already exists.');
                        }

                        var transceiver;
                        for (var i = 0; i < this.transceivers.length; i++) {
                            if (!this.transceivers[i].track &&
                                this.transceivers[i].kind === track.kind) {
                                transceiver = this.transceivers[i];
                            }
                        }
                        if (!transceiver) {
                            transceiver = this._createTransceiver(track.kind);
                        }

                        this._maybeFireNegotiationNeeded();

                        if (this.localStreams.indexOf(stream) === -1) {
                            this.localStreams.push(stream);
                        }

                        transceiver.track = track;
                        transceiver.stream = stream;
                        transceiver.rtpSender = new window.RTCRtpSender(track,
                            transceiver.dtlsTransport);
                        return transceiver.rtpSender;
                    };

                    RTCPeerConnection.prototype.addStream = function(stream) {
                        var pc = this;
                        if (edgeVersion >= 15025) {
                            stream.getTracks().forEach(function(track) {
                                pc.addTrack(track, stream);
                            });
                        } else {
                            // Clone is necessary for local demos mostly, attaching directly
                            // to two different senders does not work (build 10547).
                            // Fixed in 15025 (or earlier)
                            var clonedStream = stream.clone();
                            stream.getTracks().forEach(function(track, idx) {
                                var clonedTrack = clonedStream.getTracks()[idx];
                                track.addEventListener('enabled', function(event) {
                                    clonedTrack.enabled = event.enabled;
                                });
                            });
                            clonedStream.getTracks().forEach(function(track) {
                                pc.addTrack(track, clonedStream);
                            });
                        }
                    };

                    RTCPeerConnection.prototype.removeTrack = function(sender) {
                        if (this._isClosed) {
                            throw makeError('InvalidStateError',
                                'Attempted to call removeTrack on a closed peerconnection.');
                        }

                        if (!(sender instanceof window.RTCRtpSender)) {
                            throw new TypeError('Argument 1 of RTCPeerConnection.removeTrack ' +
                                'does not implement interface RTCRtpSender.');
                        }

                        var transceiver = this.transceivers.find(function(t) {
                            return t.rtpSender === sender;
                        });

                        if (!transceiver) {
                            throw makeError('InvalidAccessError',
                                'Sender was not created by this connection.');
                        }
                        var stream = transceiver.stream;

                        transceiver.rtpSender.stop();
                        transceiver.rtpSender = null;
                        transceiver.track = null;
                        transceiver.stream = null;

                        // remove the stream from the set of local streams
                        var localStreams = this.transceivers.map(function(t) {
                            return t.stream;
                        });
                        if (localStreams.indexOf(stream) === -1 &&
                            this.localStreams.indexOf(stream) > -1) {
                            this.localStreams.splice(this.localStreams.indexOf(stream), 1);
                        }

                        this._maybeFireNegotiationNeeded();
                    };

                    RTCPeerConnection.prototype.removeStream = function(stream) {
                        var pc = this;
                        stream.getTracks().forEach(function(track) {
                            var sender = pc.getSenders().find(function(s) {
                                return s.track === track;
                            });
                            if (sender) {
                                pc.removeTrack(sender);
                            }
                        });
                    };

                    RTCPeerConnection.prototype.getSenders = function() {
                        return this.transceivers.filter(function(transceiver) {
                                return !!transceiver.rtpSender;
                            })
                            .map(function(transceiver) {
                                return transceiver.rtpSender;
                            });
                    };

                    RTCPeerConnection.prototype.getReceivers = function() {
                        return this.transceivers.filter(function(transceiver) {
                                return !!transceiver.rtpReceiver;
                            })
                            .map(function(transceiver) {
                                return transceiver.rtpReceiver;
                            });
                    };


                    RTCPeerConnection.prototype._createIceGatherer = function(sdpMLineIndex,
                        usingBundle) {
                        var pc = this;
                        if (usingBundle && sdpMLineIndex > 0) {
                            return this.transceivers[0].iceGatherer;
                        } else if (this._iceGatherers.length) {
                            return this._iceGatherers.shift();
                        }
                        var iceGatherer = new window.RTCIceGatherer({
                            iceServers: this._config.iceServers,
                            gatherPolicy: this._config.iceTransportPolicy
                        });
                        Object.defineProperty(iceGatherer, 'state', {
                            value: 'new',
                            writable: true
                        });

                        this.transceivers[sdpMLineIndex].bufferedCandidateEvents = [];
                        this.transceivers[sdpMLineIndex].bufferCandidates = function(event) {
                            var end = !event.candidate || Object.keys(event.candidate).length === 0;
                            // polyfill since RTCIceGatherer.state is not implemented in
                            // Edge 10547 yet.
                            iceGatherer.state = end ? 'completed' : 'gathering';
                            if (pc.transceivers[sdpMLineIndex].bufferedCandidateEvents !== null) {
                                pc.transceivers[sdpMLineIndex].bufferedCandidateEvents.push(event);
                            }
                        };
                        iceGatherer.addEventListener('localcandidate',
                            this.transceivers[sdpMLineIndex].bufferCandidates);
                        return iceGatherer;
                    };

                    // start gathering from an RTCIceGatherer.
                    RTCPeerConnection.prototype._gather = function(mid, sdpMLineIndex) {
                        var pc = this;
                        var iceGatherer = this.transceivers[sdpMLineIndex].iceGatherer;
                        if (iceGatherer.onlocalcandidate) {
                            return;
                        }
                        var bufferedCandidateEvents =
                            this.transceivers[sdpMLineIndex].bufferedCandidateEvents;
                        this.transceivers[sdpMLineIndex].bufferedCandidateEvents = null;
                        iceGatherer.removeEventListener('localcandidate',
                            this.transceivers[sdpMLineIndex].bufferCandidates);
                        iceGatherer.onlocalcandidate = function(evt) {
                            if (pc.usingBundle && sdpMLineIndex > 0) {
                                // if we know that we use bundle we can drop candidates with
                                // ѕdpMLineIndex > 0. If we don't do this then our state gets
                                // confused since we dispose the extra ice gatherer.
                                return;
                            }
                            var event = new Event('icecandidate');
                            event.candidate = {
                                sdpMid: mid,
                                sdpMLineIndex: sdpMLineIndex
                            };

                            var cand = evt.candidate;
                            // Edge emits an empty object for RTCIceCandidateComplete‥
                            var end = !cand || Object.keys(cand).length === 0;
                            if (end) {
                                // polyfill since RTCIceGatherer.state is not implemented in
                                // Edge 10547 yet.
                                if (iceGatherer.state === 'new' || iceGatherer.state === 'gathering') {
                                    iceGatherer.state = 'completed';
                                }
                            } else {
                                if (iceGatherer.state === 'new') {
                                    iceGatherer.state = 'gathering';
                                }
                                // RTCIceCandidate doesn't have a component, needs to be added
                                cand.component = 1;
                                // also the usernameFragment. TODO: update SDP to take both variants.
                                cand.ufrag = iceGatherer.getLocalParameters().usernameFragment;

                                var serializedCandidate = SDPUtils.writeCandidate(cand);
                                event.candidate = Object.assign(event.candidate,
                                    SDPUtils.parseCandidate(serializedCandidate));

                                event.candidate.candidate = serializedCandidate;
                                event.candidate.toJSON = function() {
                                    return {
                                        candidate: event.candidate.candidate,
                                        sdpMid: event.candidate.sdpMid,
                                        sdpMLineIndex: event.candidate.sdpMLineIndex,
                                        usernameFragment: event.candidate.usernameFragment
                                    };
                                };
                            }

                            // update local description.
                            var sections = SDPUtils.getMediaSections(pc._localDescription.sdp);
                            if (!end) {
                                sections[event.candidate.sdpMLineIndex] +=
                                    'a=' + event.candidate.candidate + '\r\n';
                            } else {
                                sections[event.candidate.sdpMLineIndex] +=
                                    'a=end-of-candidates\r\n';
                            }
                            pc._localDescription.sdp =
                                SDPUtils.getDescription(pc._localDescription.sdp) +
                                sections.join('');
                            var complete = pc.transceivers.every(function(transceiver) {
                                return transceiver.iceGatherer &&
                                    transceiver.iceGatherer.state === 'completed';
                            });

                            if (pc.iceGatheringState !== 'gathering') {
                                pc.iceGatheringState = 'gathering';
                                pc._emitGatheringStateChange();
                            }

                            // Emit candidate. Also emit null candidate when all gatherers are
                            // complete.
                            if (!end) {
                                pc._dispatchEvent('icecandidate', event);
                            }
                            if (complete) {
                                pc._dispatchEvent('icecandidate', new Event('icecandidate'));
                                pc.iceGatheringState = 'complete';
                                pc._emitGatheringStateChange();
                            }
                        };

                        // emit already gathered candidates.
                        window.setTimeout(function() {
                            bufferedCandidateEvents.forEach(function(e) {
                                iceGatherer.onlocalcandidate(e);
                            });
                        }, 0);
                    };

                    // Create ICE transport and DTLS transport.
                    RTCPeerConnection.prototype._createIceAndDtlsTransports = function() {
                        var pc = this;
                        var iceTransport = new window.RTCIceTransport(null);
                        iceTransport.onicestatechange = function() {
                            pc._updateIceConnectionState();
                            pc._updateConnectionState();
                        };

                        var dtlsTransport = new window.RTCDtlsTransport(iceTransport);
                        dtlsTransport.ondtlsstatechange = function() {
                            pc._updateConnectionState();
                        };
                        dtlsTransport.onerror = function() {
                            // onerror does not set state to failed by itself.
                            Object.defineProperty(dtlsTransport, 'state', {
                                value: 'failed',
                                writable: true
                            });
                            pc._updateConnectionState();
                        };

                        return {
                            iceTransport: iceTransport,
                            dtlsTransport: dtlsTransport
                        };
                    };

                    // Destroy ICE gatherer, ICE transport and DTLS transport.
                    // Without triggering the callbacks.
                    RTCPeerConnection.prototype._disposeIceAndDtlsTransports = function(
                        sdpMLineIndex) {
                        var iceGatherer = this.transceivers[sdpMLineIndex].iceGatherer;
                        if (iceGatherer) {
                            delete iceGatherer.onlocalcandidate;
                            delete this.transceivers[sdpMLineIndex].iceGatherer;
                        }
                        var iceTransport = this.transceivers[sdpMLineIndex].iceTransport;
                        if (iceTransport) {
                            delete iceTransport.onicestatechange;
                            delete this.transceivers[sdpMLineIndex].iceTransport;
                        }
                        var dtlsTransport = this.transceivers[sdpMLineIndex].dtlsTransport;
                        if (dtlsTransport) {
                            delete dtlsTransport.ondtlsstatechange;
                            delete dtlsTransport.onerror;
                            delete this.transceivers[sdpMLineIndex].dtlsTransport;
                        }
                    };

                    // Start the RTP Sender and Receiver for a transceiver.
                    RTCPeerConnection.prototype._transceive = function(transceiver,
                        send, recv) {
                        var params = getCommonCapabilities(transceiver.localCapabilities,
                            transceiver.remoteCapabilities);
                        if (send && transceiver.rtpSender) {
                            params.encodings = transceiver.sendEncodingParameters;
                            params.rtcp = {
                                cname: SDPUtils.localCName,
                                compound: transceiver.rtcpParameters.compound
                            };
                            if (transceiver.recvEncodingParameters.length) {
                                params.rtcp.ssrc = transceiver.recvEncodingParameters[0].ssrc;
                            }
                            transceiver.rtpSender.send(params);
                        }
                        if (recv && transceiver.rtpReceiver && params.codecs.length > 0) {
                            // remove RTX field in Edge 14942
                            if (transceiver.kind === 'video' &&
                                transceiver.recvEncodingParameters &&
                                edgeVersion < 15019) {
                                transceiver.recvEncodingParameters.forEach(function(p) {
                                    delete p.rtx;
                                });
                            }
                            if (transceiver.recvEncodingParameters.length) {
                                params.encodings = transceiver.recvEncodingParameters;
                            } else {
                                params.encodings = [{}];
                            }
                            params.rtcp = {
                                compound: transceiver.rtcpParameters.compound
                            };
                            if (transceiver.rtcpParameters.cname) {
                                params.rtcp.cname = transceiver.rtcpParameters.cname;
                            }
                            if (transceiver.sendEncodingParameters.length) {
                                params.rtcp.ssrc = transceiver.sendEncodingParameters[0].ssrc;
                            }
                            transceiver.rtpReceiver.receive(params);
                        }
                    };

                    RTCPeerConnection.prototype.setLocalDescription = function(description) {
                        var pc = this;

                        // Note: pranswer is not supported.
                        if (['offer', 'answer'].indexOf(description.type) === -1) {
                            return Promise.reject(makeError('TypeError',
                                'Unsupported type "' + description.type + '"'));
                        }

                        if (!isActionAllowedInSignalingState('setLocalDescription',
                                description.type, pc.signalingState) || pc._isClosed) {
                            return Promise.reject(makeError('InvalidStateError',
                                'Can not set local ' + description.type +
                                ' in state ' + pc.signalingState));
                        }

                        var sections;
                        var sessionpart;
                        if (description.type === 'offer') {
                            // VERY limited support for SDP munging. Limited to:
                            // * changing the order of codecs
                            sections = SDPUtils.splitSections(description.sdp);
                            sessionpart = sections.shift();
                            sections.forEach(function(mediaSection, sdpMLineIndex) {
                                var caps = SDPUtils.parseRtpParameters(mediaSection);
                                pc.transceivers[sdpMLineIndex].localCapabilities = caps;
                            });

                            pc.transceivers.forEach(function(transceiver, sdpMLineIndex) {
                                pc._gather(transceiver.mid, sdpMLineIndex);
                            });
                        } else if (description.type === 'answer') {
                            sections = SDPUtils.splitSections(pc._remoteDescription.sdp);
                            sessionpart = sections.shift();
                            var isIceLite = SDPUtils.matchPrefix(sessionpart,
                                'a=ice-lite').length > 0;
                            sections.forEach(function(mediaSection, sdpMLineIndex) {
                                var transceiver = pc.transceivers[sdpMLineIndex];
                                var iceGatherer = transceiver.iceGatherer;
                                var iceTransport = transceiver.iceTransport;
                                var dtlsTransport = transceiver.dtlsTransport;
                                var localCapabilities = transceiver.localCapabilities;
                                var remoteCapabilities = transceiver.remoteCapabilities;

                                // treat bundle-only as not-rejected.
                                var rejected = SDPUtils.isRejected(mediaSection) &&
                                    SDPUtils.matchPrefix(mediaSection, 'a=bundle-only').length === 0;

                                if (!rejected && !transceiver.rejected) {
                                    var remoteIceParameters = SDPUtils.getIceParameters(
                                        mediaSection, sessionpart);
                                    var remoteDtlsParameters = SDPUtils.getDtlsParameters(
                                        mediaSection, sessionpart);
                                    if (isIceLite) {
                                        remoteDtlsParameters.role = 'server';
                                    }

                                    if (!pc.usingBundle || sdpMLineIndex === 0) {
                                        pc._gather(transceiver.mid, sdpMLineIndex);
                                        if (iceTransport.state === 'new') {
                                            iceTransport.start(iceGatherer, remoteIceParameters,
                                                isIceLite ? 'controlling' : 'controlled');
                                        }
                                        if (dtlsTransport.state === 'new') {
                                            dtlsTransport.start(remoteDtlsParameters);
                                        }
                                    }

                                    // Calculate intersection of capabilities.
                                    var params = getCommonCapabilities(localCapabilities,
                                        remoteCapabilities);

                                    // Start the RTCRtpSender. The RTCRtpReceiver for this
                                    // transceiver has already been started in setRemoteDescription.
                                    pc._transceive(transceiver,
                                        params.codecs.length > 0,
                                        false);
                                }
                            });
                        }

                        pc._localDescription = {
                            type: description.type,
                            sdp: description.sdp
                        };
                        if (description.type === 'offer') {
                            pc._updateSignalingState('have-local-offer');
                        } else {
                            pc._updateSignalingState('stable');
                        }

                        return Promise.resolve();
                    };

                    RTCPeerConnection.prototype.setRemoteDescription = function(description) {
                        var pc = this;

                        // Note: pranswer is not supported.
                        if (['offer', 'answer'].indexOf(description.type) === -1) {
                            return Promise.reject(makeError('TypeError',
                                'Unsupported type "' + description.type + '"'));
                        }

                        if (!isActionAllowedInSignalingState('setRemoteDescription',
                                description.type, pc.signalingState) || pc._isClosed) {
                            return Promise.reject(makeError('InvalidStateError',
                                'Can not set remote ' + description.type +
                                ' in state ' + pc.signalingState));
                        }

                        var streams = {};
                        pc.remoteStreams.forEach(function(stream) {
                            streams[stream.id] = stream;
                        });
                        var receiverList = [];
                        var sections = SDPUtils.splitSections(description.sdp);
                        var sessionpart = sections.shift();
                        var isIceLite = SDPUtils.matchPrefix(sessionpart,
                            'a=ice-lite').length > 0;
                        var usingBundle = SDPUtils.matchPrefix(sessionpart,
                            'a=group:BUNDLE ').length > 0;
                        pc.usingBundle = usingBundle;
                        var iceOptions = SDPUtils.matchPrefix(sessionpart,
                            'a=ice-options:')[0];
                        if (iceOptions) {
                            pc.canTrickleIceCandidates = iceOptions.substr(14).split(' ')
                                .indexOf('trickle') >= 0;
                        } else {
                            pc.canTrickleIceCandidates = false;
                        }

                        sections.forEach(function(mediaSection, sdpMLineIndex) {
                            var lines = SDPUtils.splitLines(mediaSection);
                            var kind = SDPUtils.getKind(mediaSection);
                            // treat bundle-only as not-rejected.
                            var rejected = SDPUtils.isRejected(mediaSection) &&
                                SDPUtils.matchPrefix(mediaSection, 'a=bundle-only').length === 0;
                            var protocol = lines[0].substr(2).split(' ')[2];

                            var direction = SDPUtils.getDirection(mediaSection, sessionpart);
                            var remoteMsid = SDPUtils.parseMsid(mediaSection);

                            var mid = SDPUtils.getMid(mediaSection) || SDPUtils.generateIdentifier();

                            // Reject datachannels which are not implemented yet.
                            if (rejected || (kind === 'application' && (protocol === 'DTLS/SCTP' ||
                                    protocol === 'UDP/DTLS/SCTP'))) {
                                // TODO: this is dangerous in the case where a non-rejected m-line
                                //     becomes rejected.
                                pc.transceivers[sdpMLineIndex] = {
                                    mid: mid,
                                    kind: kind,
                                    protocol: protocol,
                                    rejected: true
                                };
                                return;
                            }

                            if (!rejected && pc.transceivers[sdpMLineIndex] &&
                                pc.transceivers[sdpMLineIndex].rejected) {
                                // recycle a rejected transceiver.
                                pc.transceivers[sdpMLineIndex] = pc._createTransceiver(kind, true);
                            }

                            var transceiver;
                            var iceGatherer;
                            var iceTransport;
                            var dtlsTransport;
                            var rtpReceiver;
                            var sendEncodingParameters;
                            var recvEncodingParameters;
                            var localCapabilities;

                            var track;
                            // FIXME: ensure the mediaSection has rtcp-mux set.
                            var remoteCapabilities = SDPUtils.parseRtpParameters(mediaSection);
                            var remoteIceParameters;
                            var remoteDtlsParameters;
                            if (!rejected) {
                                remoteIceParameters = SDPUtils.getIceParameters(mediaSection,
                                    sessionpart);
                                remoteDtlsParameters = SDPUtils.getDtlsParameters(mediaSection,
                                    sessionpart);
                                remoteDtlsParameters.role = 'client';
                            }
                            recvEncodingParameters =
                                SDPUtils.parseRtpEncodingParameters(mediaSection);

                            var rtcpParameters = SDPUtils.parseRtcpParameters(mediaSection);

                            var isComplete = SDPUtils.matchPrefix(mediaSection,
                                'a=end-of-candidates', sessionpart).length > 0;
                            var cands = SDPUtils.matchPrefix(mediaSection, 'a=candidate:')
                                .map(function(cand) {
                                    return SDPUtils.parseCandidate(cand);
                                })
                                .filter(function(cand) {
                                    return cand.component === 1;
                                });

                            // Check if we can use BUNDLE and dispose transports.
                            if ((description.type === 'offer' || description.type === 'answer') &&
                                !rejected && usingBundle && sdpMLineIndex > 0 &&
                                pc.transceivers[sdpMLineIndex]) {
                                pc._disposeIceAndDtlsTransports(sdpMLineIndex);
                                pc.transceivers[sdpMLineIndex].iceGatherer =
                                    pc.transceivers[0].iceGatherer;
                                pc.transceivers[sdpMLineIndex].iceTransport =
                                    pc.transceivers[0].iceTransport;
                                pc.transceivers[sdpMLineIndex].dtlsTransport =
                                    pc.transceivers[0].dtlsTransport;
                                if (pc.transceivers[sdpMLineIndex].rtpSender) {
                                    pc.transceivers[sdpMLineIndex].rtpSender.setTransport(
                                        pc.transceivers[0].dtlsTransport);
                                }
                                if (pc.transceivers[sdpMLineIndex].rtpReceiver) {
                                    pc.transceivers[sdpMLineIndex].rtpReceiver.setTransport(
                                        pc.transceivers[0].dtlsTransport);
                                }
                            }
                            if (description.type === 'offer' && !rejected) {
                                transceiver = pc.transceivers[sdpMLineIndex] ||
                                    pc._createTransceiver(kind);
                                transceiver.mid = mid;

                                if (!transceiver.iceGatherer) {
                                    transceiver.iceGatherer = pc._createIceGatherer(sdpMLineIndex,
                                        usingBundle);
                                }

                                if (cands.length && transceiver.iceTransport.state === 'new') {
                                    if (isComplete && (!usingBundle || sdpMLineIndex === 0)) {
                                        transceiver.iceTransport.setRemoteCandidates(cands);
                                    } else {
                                        cands.forEach(function(candidate) {
                                            maybeAddCandidate(transceiver.iceTransport, candidate);
                                        });
                                    }
                                }

                                localCapabilities = window.RTCRtpReceiver.getCapabilities(kind);

                                // filter RTX until additional stuff needed for RTX is implemented
                                // in adapter.js
                                if (edgeVersion < 15019) {
                                    localCapabilities.codecs = localCapabilities.codecs.filter(
                                        function(codec) {
                                            return codec.name !== 'rtx';
                                        });
                                }

                                sendEncodingParameters = transceiver.sendEncodingParameters || [{
                                    ssrc: (2 * sdpMLineIndex + 2) * 1001
                                }];

                                // TODO: rewrite to use http://w3c.github.io/webrtc-pc/#set-associated-remote-streams
                                var isNewTrack = false;
                                if (direction === 'sendrecv' || direction === 'sendonly') {
                                    isNewTrack = !transceiver.rtpReceiver;
                                    rtpReceiver = transceiver.rtpReceiver ||
                                        new window.RTCRtpReceiver(transceiver.dtlsTransport, kind);

                                    if (isNewTrack) {
                                        var stream;
                                        track = rtpReceiver.track;
                                        // FIXME: does not work with Plan B.
                                        if (remoteMsid && remoteMsid.stream === '-') {
                                            // no-op. a stream id of '-' means: no associated stream.
                                        } else if (remoteMsid) {
                                            if (!streams[remoteMsid.stream]) {
                                                streams[remoteMsid.stream] = new window.MediaStream();
                                                Object.defineProperty(streams[remoteMsid.stream], 'id', {
                                                    get: function() {
                                                        return remoteMsid.stream;
                                                    }
                                                });
                                            }
                                            Object.defineProperty(track, 'id', {
                                                get: function() {
                                                    return remoteMsid.track;
                                                }
                                            });
                                            stream = streams[remoteMsid.stream];
                                        } else {
                                            if (!streams.default) {
                                                streams.default = new window.MediaStream();
                                            }
                                            stream = streams.default;
                                        }
                                        if (stream) {
                                            addTrackToStreamAndFireEvent(track, stream);
                                            transceiver.associatedRemoteMediaStreams.push(stream);
                                        }
                                        receiverList.push([track, rtpReceiver, stream]);
                                    }
                                } else if (transceiver.rtpReceiver && transceiver.rtpReceiver.track) {
                                    transceiver.associatedRemoteMediaStreams.forEach(function(s) {
                                        var nativeTrack = s.getTracks().find(function(t) {
                                            return t.id === transceiver.rtpReceiver.track.id;
                                        });
                                        if (nativeTrack) {
                                            removeTrackFromStreamAndFireEvent(nativeTrack, s);
                                        }
                                    });
                                    transceiver.associatedRemoteMediaStreams = [];
                                }

                                transceiver.localCapabilities = localCapabilities;
                                transceiver.remoteCapabilities = remoteCapabilities;
                                transceiver.rtpReceiver = rtpReceiver;
                                transceiver.rtcpParameters = rtcpParameters;
                                transceiver.sendEncodingParameters = sendEncodingParameters;
                                transceiver.recvEncodingParameters = recvEncodingParameters;

                                // Start the RTCRtpReceiver now. The RTPSender is started in
                                // setLocalDescription.
                                pc._transceive(pc.transceivers[sdpMLineIndex],
                                    false,
                                    isNewTrack);
                            } else if (description.type === 'answer' && !rejected) {
                                transceiver = pc.transceivers[sdpMLineIndex];
                                iceGatherer = transceiver.iceGatherer;
                                iceTransport = transceiver.iceTransport;
                                dtlsTransport = transceiver.dtlsTransport;
                                rtpReceiver = transceiver.rtpReceiver;
                                sendEncodingParameters = transceiver.sendEncodingParameters;
                                localCapabilities = transceiver.localCapabilities;

                                pc.transceivers[sdpMLineIndex].recvEncodingParameters =
                                    recvEncodingParameters;
                                pc.transceivers[sdpMLineIndex].remoteCapabilities =
                                    remoteCapabilities;
                                pc.transceivers[sdpMLineIndex].rtcpParameters = rtcpParameters;

                                if (cands.length && iceTransport.state === 'new') {
                                    if ((isIceLite || isComplete) &&
                                        (!usingBundle || sdpMLineIndex === 0)) {
                                        iceTransport.setRemoteCandidates(cands);
                                    } else {
                                        cands.forEach(function(candidate) {
                                            maybeAddCandidate(transceiver.iceTransport, candidate);
                                        });
                                    }
                                }

                                if (!usingBundle || sdpMLineIndex === 0) {
                                    if (iceTransport.state === 'new') {
                                        iceTransport.start(iceGatherer, remoteIceParameters,
                                            'controlling');
                                    }
                                    if (dtlsTransport.state === 'new') {
                                        dtlsTransport.start(remoteDtlsParameters);
                                    }
                                }

                                // If the offer contained RTX but the answer did not,
                                // remove RTX from sendEncodingParameters.
                                var commonCapabilities = getCommonCapabilities(
                                    transceiver.localCapabilities,
                                    transceiver.remoteCapabilities);

                                var hasRtx = commonCapabilities.codecs.filter(function(c) {
                                    return c.name.toLowerCase() === 'rtx';
                                }).length;
                                if (!hasRtx && transceiver.sendEncodingParameters[0].rtx) {
                                    delete transceiver.sendEncodingParameters[0].rtx;
                                }

                                pc._transceive(transceiver,
                                    direction === 'sendrecv' || direction === 'recvonly',
                                    direction === 'sendrecv' || direction === 'sendonly');

                                // TODO: rewrite to use http://w3c.github.io/webrtc-pc/#set-associated-remote-streams
                                if (rtpReceiver &&
                                    (direction === 'sendrecv' || direction === 'sendonly')) {
                                    track = rtpReceiver.track;
                                    if (remoteMsid) {
                                        if (!streams[remoteMsid.stream]) {
                                            streams[remoteMsid.stream] = new window.MediaStream();
                                        }
                                        addTrackToStreamAndFireEvent(track, streams[remoteMsid.stream]);
                                        receiverList.push([track, rtpReceiver, streams[remoteMsid.stream]]);
                                    } else {
                                        if (!streams.default) {
                                            streams.default = new window.MediaStream();
                                        }
                                        addTrackToStreamAndFireEvent(track, streams.default);
                                        receiverList.push([track, rtpReceiver, streams.default]);
                                    }
                                } else {
                                    // FIXME: actually the receiver should be created later.
                                    delete transceiver.rtpReceiver;
                                }
                            }
                        });

                        if (pc._dtlsRole === undefined) {
                            pc._dtlsRole = description.type === 'offer' ? 'active' : 'passive';
                        }

                        pc._remoteDescription = {
                            type: description.type,
                            sdp: description.sdp
                        };
                        if (description.type === 'offer') {
                            pc._updateSignalingState('have-remote-offer');
                        } else {
                            pc._updateSignalingState('stable');
                        }
                        Object.keys(streams).forEach(function(sid) {
                            var stream = streams[sid];
                            if (stream.getTracks().length) {
                                if (pc.remoteStreams.indexOf(stream) === -1) {
                                    pc.remoteStreams.push(stream);
                                    var event = new Event('addstream');
                                    event.stream = stream;
                                    window.setTimeout(function() {
                                        pc._dispatchEvent('addstream', event);
                                    });
                                }

                                receiverList.forEach(function(item) {
                                    var track = item[0];
                                    var receiver = item[1];
                                    if (stream.id !== item[2].id) {
                                        return;
                                    }
                                    fireAddTrack(pc, track, receiver, [stream]);
                                });
                            }
                        });
                        receiverList.forEach(function(item) {
                            if (item[2]) {
                                return;
                            }
                            fireAddTrack(pc, item[0], item[1], []);
                        });

                        // check whether addIceCandidate({}) was called within four seconds after
                        // setRemoteDescription.
                        window.setTimeout(function() {
                            if (!(pc && pc.transceivers)) {
                                return;
                            }
                            pc.transceivers.forEach(function(transceiver) {
                                if (transceiver.iceTransport &&
                                    transceiver.iceTransport.state === 'new' &&
                                    transceiver.iceTransport.getRemoteCandidates().length > 0) {
                                    console.warn('Timeout for addRemoteCandidate. Consider sending ' +
                                        'an end-of-candidates notification');
                                    transceiver.iceTransport.addRemoteCandidate({});
                                }
                            });
                        }, 4000);

                        return Promise.resolve();
                    };

                    RTCPeerConnection.prototype.close = function() {
                        this.transceivers.forEach(function(transceiver) {
                            /* not yet
                            if (transceiver.iceGatherer) {
                              transceiver.iceGatherer.close();
                            }
                            */
                            if (transceiver.iceTransport) {
                                transceiver.iceTransport.stop();
                            }
                            if (transceiver.dtlsTransport) {
                                transceiver.dtlsTransport.stop();
                            }
                            if (transceiver.rtpSender) {
                                transceiver.rtpSender.stop();
                            }
                            if (transceiver.rtpReceiver) {
                                transceiver.rtpReceiver.stop();
                            }
                        });
                        // FIXME: clean up tracks, local streams, remote streams, etc
                        this._isClosed = true;
                        this._updateSignalingState('closed');
                    };

                    // Update the signaling state.
                    RTCPeerConnection.prototype._updateSignalingState = function(newState) {
                        this.signalingState = newState;
                        var event = new Event('signalingstatechange');
                        this._dispatchEvent('signalingstatechange', event);
                    };

                    // Determine whether to fire the negotiationneeded event.
                    RTCPeerConnection.prototype._maybeFireNegotiationNeeded = function() {
                        var pc = this;
                        if (this.signalingState !== 'stable' || this.needNegotiation === true) {
                            return;
                        }
                        this.needNegotiation = true;
                        window.setTimeout(function() {
                            if (pc.needNegotiation) {
                                pc.needNegotiation = false;
                                var event = new Event('negotiationneeded');
                                pc._dispatchEvent('negotiationneeded', event);
                            }
                        }, 0);
                    };

                    // Update the ice connection state.
                    RTCPeerConnection.prototype._updateIceConnectionState = function() {
                        var newState;
                        var states = {
                            'new': 0,
                            closed: 0,
                            checking: 0,
                            connected: 0,
                            completed: 0,
                            disconnected: 0,
                            failed: 0
                        };
                        this.transceivers.forEach(function(transceiver) {
                            if (transceiver.iceTransport && !transceiver.rejected) {
                                states[transceiver.iceTransport.state]++;
                            }
                        });

                        newState = 'new';
                        if (states.failed > 0) {
                            newState = 'failed';
                        } else if (states.checking > 0) {
                            newState = 'checking';
                        } else if (states.disconnected > 0) {
                            newState = 'disconnected';
                        } else if (states.new > 0) {
                            newState = 'new';
                        } else if (states.connected > 0) {
                            newState = 'connected';
                        } else if (states.completed > 0) {
                            newState = 'completed';
                        }

                        if (newState !== this.iceConnectionState) {
                            this.iceConnectionState = newState;
                            var event = new Event('iceconnectionstatechange');
                            this._dispatchEvent('iceconnectionstatechange', event);
                        }
                    };

                    // Update the connection state.
                    RTCPeerConnection.prototype._updateConnectionState = function() {
                        var newState;
                        var states = {
                            'new': 0,
                            closed: 0,
                            connecting: 0,
                            connected: 0,
                            completed: 0,
                            disconnected: 0,
                            failed: 0
                        };
                        this.transceivers.forEach(function(transceiver) {
                            if (transceiver.iceTransport && transceiver.dtlsTransport &&
                                !transceiver.rejected) {
                                states[transceiver.iceTransport.state]++;
                                states[transceiver.dtlsTransport.state]++;
                            }
                        });
                        // ICETransport.completed and connected are the same for this purpose.
                        states.connected += states.completed;

                        newState = 'new';
                        if (states.failed > 0) {
                            newState = 'failed';
                        } else if (states.connecting > 0) {
                            newState = 'connecting';
                        } else if (states.disconnected > 0) {
                            newState = 'disconnected';
                        } else if (states.new > 0) {
                            newState = 'new';
                        } else if (states.connected > 0) {
                            newState = 'connected';
                        }

                        if (newState !== this.connectionState) {
                            this.connectionState = newState;
                            var event = new Event('connectionstatechange');
                            this._dispatchEvent('connectionstatechange', event);
                        }
                    };

                    RTCPeerConnection.prototype.createOffer = function() {
                        var pc = this;

                        if (pc._isClosed) {
                            return Promise.reject(makeError('InvalidStateError',
                                'Can not call createOffer after close'));
                        }

                        var numAudioTracks = pc.transceivers.filter(function(t) {
                            return t.kind === 'audio';
                        }).length;
                        var numVideoTracks = pc.transceivers.filter(function(t) {
                            return t.kind === 'video';
                        }).length;

                        // Determine number of audio and video tracks we need to send/recv.
                        var offerOptions = arguments[0];
                        if (offerOptions) {
                            // Reject Chrome legacy constraints.
                            if (offerOptions.mandatory || offerOptions.optional) {
                                throw new TypeError(
                                    'Legacy mandatory/optional constraints not supported.');
                            }
                            if (offerOptions.offerToReceiveAudio !== undefined) {
                                if (offerOptions.offerToReceiveAudio === true) {
                                    numAudioTracks = 1;
                                } else if (offerOptions.offerToReceiveAudio === false) {
                                    numAudioTracks = 0;
                                } else {
                                    numAudioTracks = offerOptions.offerToReceiveAudio;
                                }
                            }
                            if (offerOptions.offerToReceiveVideo !== undefined) {
                                if (offerOptions.offerToReceiveVideo === true) {
                                    numVideoTracks = 1;
                                } else if (offerOptions.offerToReceiveVideo === false) {
                                    numVideoTracks = 0;
                                } else {
                                    numVideoTracks = offerOptions.offerToReceiveVideo;
                                }
                            }
                        }

                        pc.transceivers.forEach(function(transceiver) {
                            if (transceiver.kind === 'audio') {
                                numAudioTracks--;
                                if (numAudioTracks < 0) {
                                    transceiver.wantReceive = false;
                                }
                            } else if (transceiver.kind === 'video') {
                                numVideoTracks--;
                                if (numVideoTracks < 0) {
                                    transceiver.wantReceive = false;
                                }
                            }
                        });

                        // Create M-lines for recvonly streams.
                        while (numAudioTracks > 0 || numVideoTracks > 0) {
                            if (numAudioTracks > 0) {
                                pc._createTransceiver('audio');
                                numAudioTracks--;
                            }
                            if (numVideoTracks > 0) {
                                pc._createTransceiver('video');
                                numVideoTracks--;
                            }
                        }

                        var sdp = SDPUtils.writeSessionBoilerplate(pc._sdpSessionId,
                            pc._sdpSessionVersion++);
                        pc.transceivers.forEach(function(transceiver, sdpMLineIndex) {
                            // For each track, create an ice gatherer, ice transport,
                            // dtls transport, potentially rtpsender and rtpreceiver.
                            var track = transceiver.track;
                            var kind = transceiver.kind;
                            var mid = transceiver.mid || SDPUtils.generateIdentifier();
                            transceiver.mid = mid;

                            if (!transceiver.iceGatherer) {
                                transceiver.iceGatherer = pc._createIceGatherer(sdpMLineIndex,
                                    pc.usingBundle);
                            }

                            var localCapabilities = window.RTCRtpSender.getCapabilities(kind);
                            // filter RTX until additional stuff needed for RTX is implemented
                            // in adapter.js
                            if (edgeVersion < 15019) {
                                localCapabilities.codecs = localCapabilities.codecs.filter(
                                    function(codec) {
                                        return codec.name !== 'rtx';
                                    });
                            }
                            localCapabilities.codecs.forEach(function(codec) {
                                // work around https://bugs.chromium.org/p/webrtc/issues/detail?id=6552
                                // by adding level-asymmetry-allowed=1
                                if (codec.name === 'H264' &&
                                    codec.parameters['level-asymmetry-allowed'] === undefined) {
                                    codec.parameters['level-asymmetry-allowed'] = '1';
                                }

                                // for subsequent offers, we might have to re-use the payload
                                // type of the last offer.
                                if (transceiver.remoteCapabilities &&
                                    transceiver.remoteCapabilities.codecs) {
                                    transceiver.remoteCapabilities.codecs.forEach(function(remoteCodec) {
                                        if (codec.name.toLowerCase() === remoteCodec.name.toLowerCase() &&
                                            codec.clockRate === remoteCodec.clockRate) {
                                            codec.preferredPayloadType = remoteCodec.payloadType;
                                        }
                                    });
                                }
                            });
                            localCapabilities.headerExtensions.forEach(function(hdrExt) {
                                var remoteExtensions = transceiver.remoteCapabilities &&
                                    transceiver.remoteCapabilities.headerExtensions || [];
                                remoteExtensions.forEach(function(rHdrExt) {
                                    if (hdrExt.uri === rHdrExt.uri) {
                                        hdrExt.id = rHdrExt.id;
                                    }
                                });
                            });

                            // generate an ssrc now, to be used later in rtpSender.send
                            var sendEncodingParameters = transceiver.sendEncodingParameters || [{
                                ssrc: (2 * sdpMLineIndex + 1) * 1001
                            }];
                            if (track) {
                                // add RTX
                                if (edgeVersion >= 15019 && kind === 'video' &&
                                    !sendEncodingParameters[0].rtx) {
                                    sendEncodingParameters[0].rtx = {
                                        ssrc: sendEncodingParameters[0].ssrc + 1
                                    };
                                }
                            }

                            if (transceiver.wantReceive) {
                                transceiver.rtpReceiver = new window.RTCRtpReceiver(
                                    transceiver.dtlsTransport, kind);
                            }

                            transceiver.localCapabilities = localCapabilities;
                            transceiver.sendEncodingParameters = sendEncodingParameters;
                        });

                        // always offer BUNDLE and dispose on return if not supported.
                        if (pc._config.bundlePolicy !== 'max-compat') {
                            sdp += 'a=group:BUNDLE ' + pc.transceivers.map(function(t) {
                                return t.mid;
                            }).join(' ') + '\r\n';
                        }
                        sdp += 'a=ice-options:trickle\r\n';

                        pc.transceivers.forEach(function(transceiver, sdpMLineIndex) {
                            sdp += writeMediaSection(transceiver, transceiver.localCapabilities,
                                'offer', transceiver.stream, pc._dtlsRole);
                            sdp += 'a=rtcp-rsize\r\n';

                            if (transceiver.iceGatherer && pc.iceGatheringState !== 'new' &&
                                (sdpMLineIndex === 0 || !pc.usingBundle)) {
                                transceiver.iceGatherer.getLocalCandidates().forEach(function(cand) {
                                    cand.component = 1;
                                    sdp += 'a=' + SDPUtils.writeCandidate(cand) + '\r\n';
                                });

                                if (transceiver.iceGatherer.state === 'completed') {
                                    sdp += 'a=end-of-candidates\r\n';
                                }
                            }
                        });

                        var desc = new window.RTCSessionDescription({
                            type: 'offer',
                            sdp: sdp
                        });
                        return Promise.resolve(desc);
                    };

                    RTCPeerConnection.prototype.createAnswer = function() {
                        var pc = this;

                        if (pc._isClosed) {
                            return Promise.reject(makeError('InvalidStateError',
                                'Can not call createAnswer after close'));
                        }

                        if (!(pc.signalingState === 'have-remote-offer' ||
                                pc.signalingState === 'have-local-pranswer')) {
                            return Promise.reject(makeError('InvalidStateError',
                                'Can not call createAnswer in signalingState ' + pc.signalingState));
                        }

                        var sdp = SDPUtils.writeSessionBoilerplate(pc._sdpSessionId,
                            pc._sdpSessionVersion++);
                        if (pc.usingBundle) {
                            sdp += 'a=group:BUNDLE ' + pc.transceivers.map(function(t) {
                                return t.mid;
                            }).join(' ') + '\r\n';
                        }
                        sdp += 'a=ice-options:trickle\r\n';

                        var mediaSectionsInOffer = SDPUtils.getMediaSections(
                            pc._remoteDescription.sdp).length;
                        pc.transceivers.forEach(function(transceiver, sdpMLineIndex) {
                            if (sdpMLineIndex + 1 > mediaSectionsInOffer) {
                                return;
                            }
                            if (transceiver.rejected) {
                                if (transceiver.kind === 'application') {
                                    if (transceiver.protocol === 'DTLS/SCTP') { // legacy fmt
                                        sdp += 'm=application 0 DTLS/SCTP 5000\r\n';
                                    } else {
                                        sdp += 'm=application 0 ' + transceiver.protocol +
                                            ' webrtc-datachannel\r\n';
                                    }
                                } else if (transceiver.kind === 'audio') {
                                    sdp += 'm=audio 0 UDP/TLS/RTP/SAVPF 0\r\n' +
                                        'a=rtpmap:0 PCMU/8000\r\n';
                                } else if (transceiver.kind === 'video') {
                                    sdp += 'm=video 0 UDP/TLS/RTP/SAVPF 120\r\n' +
                                        'a=rtpmap:120 VP8/90000\r\n';
                                }
                                sdp += 'c=IN IP4 0.0.0.0\r\n' +
                                    'a=inactive\r\n' +
                                    'a=mid:' + transceiver.mid + '\r\n';
                                return;
                            }

                            // FIXME: look at direction.
                            if (transceiver.stream) {
                                var localTrack;
                                if (transceiver.kind === 'audio') {
                                    localTrack = transceiver.stream.getAudioTracks()[0];
                                } else if (transceiver.kind === 'video') {
                                    localTrack = transceiver.stream.getVideoTracks()[0];
                                }
                                if (localTrack) {
                                    // add RTX
                                    if (edgeVersion >= 15019 && transceiver.kind === 'video' &&
                                        !transceiver.sendEncodingParameters[0].rtx) {
                                        transceiver.sendEncodingParameters[0].rtx = {
                                            ssrc: transceiver.sendEncodingParameters[0].ssrc + 1
                                        };
                                    }
                                }
                            }

                            // Calculate intersection of capabilities.
                            var commonCapabilities = getCommonCapabilities(
                                transceiver.localCapabilities,
                                transceiver.remoteCapabilities);

                            var hasRtx = commonCapabilities.codecs.filter(function(c) {
                                return c.name.toLowerCase() === 'rtx';
                            }).length;
                            if (!hasRtx && transceiver.sendEncodingParameters[0].rtx) {
                                delete transceiver.sendEncodingParameters[0].rtx;
                            }

                            sdp += writeMediaSection(transceiver, commonCapabilities,
                                'answer', transceiver.stream, pc._dtlsRole);
                            if (transceiver.rtcpParameters &&
                                transceiver.rtcpParameters.reducedSize) {
                                sdp += 'a=rtcp-rsize\r\n';
                            }
                        });

                        var desc = new window.RTCSessionDescription({
                            type: 'answer',
                            sdp: sdp
                        });
                        return Promise.resolve(desc);
                    };

                    RTCPeerConnection.prototype.addIceCandidate = function(candidate) {
                        var pc = this;
                        var sections;
                        if (candidate && !(candidate.sdpMLineIndex !== undefined ||
                                candidate.sdpMid)) {
                            return Promise.reject(new TypeError('sdpMLineIndex or sdpMid required'));
                        }

                        // TODO: needs to go into ops queue.
                        return new Promise(function(resolve, reject) {
                            if (!pc._remoteDescription) {
                                return reject(makeError('InvalidStateError',
                                    'Can not add ICE candidate without a remote description'));
                            } else if (!candidate || candidate.candidate === '') {
                                for (var j = 0; j < pc.transceivers.length; j++) {
                                    if (pc.transceivers[j].rejected) {
                                        continue;
                                    }
                                    pc.transceivers[j].iceTransport.addRemoteCandidate({});
                                    sections = SDPUtils.getMediaSections(pc._remoteDescription.sdp);
                                    sections[j] += 'a=end-of-candidates\r\n';
                                    pc._remoteDescription.sdp =
                                        SDPUtils.getDescription(pc._remoteDescription.sdp) +
                                        sections.join('');
                                    if (pc.usingBundle) {
                                        break;
                                    }
                                }
                            } else {
                                var sdpMLineIndex = candidate.sdpMLineIndex;
                                if (candidate.sdpMid) {
                                    for (var i = 0; i < pc.transceivers.length; i++) {
                                        if (pc.transceivers[i].mid === candidate.sdpMid) {
                                            sdpMLineIndex = i;
                                            break;
                                        }
                                    }
                                }
                                var transceiver = pc.transceivers[sdpMLineIndex];
                                if (transceiver) {
                                    if (transceiver.rejected) {
                                        return resolve();
                                    }
                                    var cand = Object.keys(candidate.candidate).length > 0 ?
                                        SDPUtils.parseCandidate(candidate.candidate) : {};
                                    // Ignore Chrome's invalid candidates since Edge does not like them.
                                    if (cand.protocol === 'tcp' && (cand.port === 0 || cand.port === 9)) {
                                        return resolve();
                                    }
                                    // Ignore RTCP candidates, we assume RTCP-MUX.
                                    if (cand.component && cand.component !== 1) {
                                        return resolve();
                                    }
                                    // when using bundle, avoid adding candidates to the wrong
                                    // ice transport. And avoid adding candidates added in the SDP.
                                    if (sdpMLineIndex === 0 || (sdpMLineIndex > 0 &&
                                            transceiver.iceTransport !== pc.transceivers[0].iceTransport)) {
                                        if (!maybeAddCandidate(transceiver.iceTransport, cand)) {
                                            return reject(makeError('OperationError',
                                                'Can not add ICE candidate'));
                                        }
                                    }

                                    // update the remoteDescription.
                                    var candidateString = candidate.candidate.trim();
                                    if (candidateString.indexOf('a=') === 0) {
                                        candidateString = candidateString.substr(2);
                                    }
                                    sections = SDPUtils.getMediaSections(pc._remoteDescription.sdp);
                                    sections[sdpMLineIndex] += 'a=' +
                                        (cand.type ? candidateString : 'end-of-candidates') +
                                        '\r\n';
                                    pc._remoteDescription.sdp =
                                        SDPUtils.getDescription(pc._remoteDescription.sdp) +
                                        sections.join('');
                                } else {
                                    return reject(makeError('OperationError',
                                        'Can not add ICE candidate'));
                                }
                            }
                            resolve();
                        });
                    };

                    RTCPeerConnection.prototype.getStats = function(selector) {
                        if (selector && selector instanceof window.MediaStreamTrack) {
                            var senderOrReceiver = null;
                            this.transceivers.forEach(function(transceiver) {
                                if (transceiver.rtpSender &&
                                    transceiver.rtpSender.track === selector) {
                                    senderOrReceiver = transceiver.rtpSender;
                                } else if (transceiver.rtpReceiver &&
                                    transceiver.rtpReceiver.track === selector) {
                                    senderOrReceiver = transceiver.rtpReceiver;
                                }
                            });
                            if (!senderOrReceiver) {
                                throw makeError('InvalidAccessError', 'Invalid selector.');
                            }
                            return senderOrReceiver.getStats();
                        }

                        var promises = [];
                        this.transceivers.forEach(function(transceiver) {
                            ['rtpSender', 'rtpReceiver', 'iceGatherer', 'iceTransport',
                                'dtlsTransport'
                            ].forEach(function(method) {
                                if (transceiver[method]) {
                                    promises.push(transceiver[method].getStats());
                                }
                            });
                        });
                        return Promise.all(promises).then(function(allStats) {
                            var results = new Map();
                            allStats.forEach(function(stats) {
                                stats.forEach(function(stat) {
                                    results.set(stat.id, stat);
                                });
                            });
                            return results;
                        });
                    };

                    // fix low-level stat names and return Map instead of object.
                    var ortcObjects = ['RTCRtpSender', 'RTCRtpReceiver', 'RTCIceGatherer',
                        'RTCIceTransport', 'RTCDtlsTransport'
                    ];
                    ortcObjects.forEach(function(ortcObjectName) {
                        var obj = window[ortcObjectName];
                        if (obj && obj.prototype && obj.prototype.getStats) {
                            var nativeGetstats = obj.prototype.getStats;
                            obj.prototype.getStats = function() {
                                return nativeGetstats.apply(this)
                                    .then(function(nativeStats) {
                                        var mapStats = new Map();
                                        Object.keys(nativeStats).forEach(function(id) {
                                            nativeStats[id].type = fixStatsType(nativeStats[id]);
                                            mapStats.set(id, nativeStats[id]);
                                        });
                                        return mapStats;
                                    });
                            };
                        }
                    });

                    // legacy callback shims. Should be moved to adapter.js some days.
                    var methods = ['createOffer', 'createAnswer'];
                    methods.forEach(function(method) {
                        var nativeMethod = RTCPeerConnection.prototype[method];
                        RTCPeerConnection.prototype[method] = function() {
                            var args = arguments;
                            if (typeof args[0] === 'function' ||
                                typeof args[1] === 'function') { // legacy
                                return nativeMethod.apply(this, [arguments[2]])
                                    .then(function(description) {
                                        if (typeof args[0] === 'function') {
                                            args[0].apply(null, [description]);
                                        }
                                    }, function(error) {
                                        if (typeof args[1] === 'function') {
                                            args[1].apply(null, [error]);
                                        }
                                    });
                            }
                            return nativeMethod.apply(this, arguments);
                        };
                    });

                    methods = ['setLocalDescription', 'setRemoteDescription', 'addIceCandidate'];
                    methods.forEach(function(method) {
                        var nativeMethod = RTCPeerConnection.prototype[method];
                        RTCPeerConnection.prototype[method] = function() {
                            var args = arguments;
                            if (typeof args[1] === 'function' ||
                                typeof args[2] === 'function') { // legacy
                                return nativeMethod.apply(this, arguments)
                                    .then(function() {
                                        if (typeof args[1] === 'function') {
                                            args[1].apply(null);
                                        }
                                    }, function(error) {
                                        if (typeof args[2] === 'function') {
                                            args[2].apply(null, [error]);
                                        }
                                    });
                            }
                            return nativeMethod.apply(this, arguments);
                        };
                    });

                    // getStats is special. It doesn't have a spec legacy method yet we support
                    // getStats(something, cb) without error callbacks.
                    ['getStats'].forEach(function(method) {
                        var nativeMethod = RTCPeerConnection.prototype[method];
                        RTCPeerConnection.prototype[method] = function() {
                            var args = arguments;
                            if (typeof args[1] === 'function') {
                                return nativeMethod.apply(this, arguments)
                                    .then(function() {
                                        if (typeof args[1] === 'function') {
                                            args[1].apply(null);
                                        }
                                    });
                            }
                            return nativeMethod.apply(this, arguments);
                        };
                    });

                    return RTCPeerConnection;
                };

            }, {
                "sdp": 17
            }],
            17: [function(require, module, exports) {
                /* eslint-env node */
                'use strict';

                // SDP helpers.
                var SDPUtils = {};

                // Generate an alphanumeric identifier for cname or mids.
                // TODO: use UUIDs instead? https://gist.github.com/jed/982883
                SDPUtils.generateIdentifier = function() {
                    return Math.random().toString(36).substr(2, 10);
                };

                // The RTCP CNAME used by all peerconnections from the same JS.
                SDPUtils.localCName = SDPUtils.generateIdentifier();

                // Splits SDP into lines, dealing with both CRLF and LF.
                SDPUtils.splitLines = function(blob) {
                    return blob.trim().split('\n').map(function(line) {
                        return line.trim();
                    });
                };
                // Splits SDP into sessionpart and mediasections. Ensures CRLF.
                SDPUtils.splitSections = function(blob) {
                    var parts = blob.split('\nm=');
                    return parts.map(function(part, index) {
                        return (index > 0 ? 'm=' + part : part).trim() + '\r\n';
                    });
                };

                // returns the session description.
                SDPUtils.getDescription = function(blob) {
                    var sections = SDPUtils.splitSections(blob);
                    return sections && sections[0];
                };

                // returns the individual media sections.
                SDPUtils.getMediaSections = function(blob) {
                    var sections = SDPUtils.splitSections(blob);
                    sections.shift();
                    return sections;
                };

                // Returns lines that start with a certain prefix.
                SDPUtils.matchPrefix = function(blob, prefix) {
                    return SDPUtils.splitLines(blob).filter(function(line) {
                        return line.indexOf(prefix) === 0;
                    });
                };

                // Parses an ICE candidate line. Sample input:
                // candidate:702786350 2 udp 41819902 8.8.8.8 60769 typ relay raddr 8.8.8.8
                // rport 55996"
                SDPUtils.parseCandidate = function(line) {
                    var parts;
                    // Parse both variants.
                    if (line.indexOf('a=candidate:') === 0) {
                        parts = line.substring(12).split(' ');
                    } else {
                        parts = line.substring(10).split(' ');
                    }

                    var candidate = {
                        foundation: parts[0],
                        component: parseInt(parts[1], 10),
                        protocol: parts[2].toLowerCase(),
                        priority: parseInt(parts[3], 10),
                        ip: parts[4],
                        address: parts[4], // address is an alias for ip.
                        port: parseInt(parts[5], 10),
                        // skip parts[6] == 'typ'
                        type: parts[7]
                    };

                    for (var i = 8; i < parts.length; i += 2) {
                        switch (parts[i]) {
                            case 'raddr':
                                candidate.relatedAddress = parts[i + 1];
                                break;
                            case 'rport':
                                candidate.relatedPort = parseInt(parts[i + 1], 10);
                                break;
                            case 'tcptype':
                                candidate.tcpType = parts[i + 1];
                                break;
                            case 'ufrag':
                                candidate.ufrag = parts[i + 1]; // for backward compability.
                                candidate.usernameFragment = parts[i + 1];
                                break;
                            default: // extension handling, in particular ufrag
                                candidate[parts[i]] = parts[i + 1];
                                break;
                        }
                    }
                    return candidate;
                };

                // Translates a candidate object into SDP candidate attribute.
                SDPUtils.writeCandidate = function(candidate) {
                    var sdp = [];
                    sdp.push(candidate.foundation);
                    sdp.push(candidate.component);
                    sdp.push(candidate.protocol.toUpperCase());
                    sdp.push(candidate.priority);
                    sdp.push(candidate.address || candidate.ip);
                    sdp.push(candidate.port);

                    var type = candidate.type;
                    sdp.push('typ');
                    sdp.push(type);
                    if (type !== 'host' && candidate.relatedAddress &&
                        candidate.relatedPort) {
                        sdp.push('raddr');
                        sdp.push(candidate.relatedAddress);
                        sdp.push('rport');
                        sdp.push(candidate.relatedPort);
                    }
                    if (candidate.tcpType && candidate.protocol.toLowerCase() === 'tcp') {
                        sdp.push('tcptype');
                        sdp.push(candidate.tcpType);
                    }
                    if (candidate.usernameFragment || candidate.ufrag) {
                        sdp.push('ufrag');
                        sdp.push(candidate.usernameFragment || candidate.ufrag);
                    }
                    return 'candidate:' + sdp.join(' ');
                };

                // Parses an ice-options line, returns an array of option tags.
                // a=ice-options:foo bar
                SDPUtils.parseIceOptions = function(line) {
                    return line.substr(14).split(' ');
                };

                // Parses an rtpmap line, returns RTCRtpCoddecParameters. Sample input:
                // a=rtpmap:111 opus/48000/2
                SDPUtils.parseRtpMap = function(line) {
                    var parts = line.substr(9).split(' ');
                    var parsed = {
                        payloadType: parseInt(parts.shift(), 10) // was: id
                    };

                    parts = parts[0].split('/');

                    parsed.name = parts[0];
                    parsed.clockRate = parseInt(parts[1], 10); // was: clockrate
                    parsed.channels = parts.length === 3 ? parseInt(parts[2], 10) : 1;
                    // legacy alias, got renamed back to channels in ORTC.
                    parsed.numChannels = parsed.channels;
                    return parsed;
                };

                // Generate an a=rtpmap line from RTCRtpCodecCapability or
                // RTCRtpCodecParameters.
                SDPUtils.writeRtpMap = function(codec) {
                    var pt = codec.payloadType;
                    if (codec.preferredPayloadType !== undefined) {
                        pt = codec.preferredPayloadType;
                    }
                    var channels = codec.channels || codec.numChannels || 1;
                    return 'a=rtpmap:' + pt + ' ' + codec.name + '/' + codec.clockRate +
                        (channels !== 1 ? '/' + channels : '') + '\r\n';
                };

                // Parses an a=extmap line (headerextension from RFC 5285). Sample input:
                // a=extmap:2 urn:ietf:params:rtp-hdrext:toffset
                // a=extmap:2/sendonly urn:ietf:params:rtp-hdrext:toffset
                SDPUtils.parseExtmap = function(line) {
                    var parts = line.substr(9).split(' ');
                    return {
                        id: parseInt(parts[0], 10),
                        direction: parts[0].indexOf('/') > 0 ? parts[0].split('/')[1] : 'sendrecv',
                        uri: parts[1]
                    };
                };

                // Generates a=extmap line from RTCRtpHeaderExtensionParameters or
                // RTCRtpHeaderExtension.
                SDPUtils.writeExtmap = function(headerExtension) {
                    return 'a=extmap:' + (headerExtension.id || headerExtension.preferredId) +
                        (headerExtension.direction && headerExtension.direction !== 'sendrecv' ?
                            '/' + headerExtension.direction :
                            '') +
                        ' ' + headerExtension.uri + '\r\n';
                };

                // Parses an ftmp line, returns dictionary. Sample input:
                // a=fmtp:96 vbr=on;cng=on
                // Also deals with vbr=on; cng=on
                SDPUtils.parseFmtp = function(line) {
                    var parsed = {};
                    var kv;
                    var parts = line.substr(line.indexOf(' ') + 1).split(';');
                    for (var j = 0; j < parts.length; j++) {
                        kv = parts[j].trim().split('=');
                        parsed[kv[0].trim()] = kv[1];
                    }
                    return parsed;
                };

                // Generates an a=ftmp line from RTCRtpCodecCapability or RTCRtpCodecParameters.
                SDPUtils.writeFmtp = function(codec) {
                    var line = '';
                    var pt = codec.payloadType;
                    if (codec.preferredPayloadType !== undefined) {
                        pt = codec.preferredPayloadType;
                    }
                    if (codec.parameters && Object.keys(codec.parameters).length) {
                        var params = [];
                        Object.keys(codec.parameters).forEach(function(param) {
                            if (codec.parameters[param]) {
                                params.push(param + '=' + codec.parameters[param]);
                            } else {
                                params.push(param);
                            }
                        });
                        line += 'a=fmtp:' + pt + ' ' + params.join(';') + '\r\n';
                    }
                    return line;
                };

                // Parses an rtcp-fb line, returns RTCPRtcpFeedback object. Sample input:
                // a=rtcp-fb:98 nack rpsi
                SDPUtils.parseRtcpFb = function(line) {
                    var parts = line.substr(line.indexOf(' ') + 1).split(' ');
                    return {
                        type: parts.shift(),
                        parameter: parts.join(' ')
                    };
                };
                // Generate a=rtcp-fb lines from RTCRtpCodecCapability or RTCRtpCodecParameters.
                SDPUtils.writeRtcpFb = function(codec) {
                    var lines = '';
                    var pt = codec.payloadType;
                    if (codec.preferredPayloadType !== undefined) {
                        pt = codec.preferredPayloadType;
                    }
                    if (codec.rtcpFeedback && codec.rtcpFeedback.length) {
                        // FIXME: special handling for trr-int?
                        codec.rtcpFeedback.forEach(function(fb) {
                            lines += 'a=rtcp-fb:' + pt + ' ' + fb.type +
                                (fb.parameter && fb.parameter.length ? ' ' + fb.parameter : '') +
                                '\r\n';
                        });
                    }
                    return lines;
                };

                // Parses an RFC 5576 ssrc media attribute. Sample input:
                // a=ssrc:3735928559 cname:something
                SDPUtils.parseSsrcMedia = function(line) {
                    var sp = line.indexOf(' ');
                    var parts = {
                        ssrc: parseInt(line.substr(7, sp - 7), 10)
                    };
                    var colon = line.indexOf(':', sp);
                    if (colon > -1) {
                        parts.attribute = line.substr(sp + 1, colon - sp - 1);
                        parts.value = line.substr(colon + 1);
                    } else {
                        parts.attribute = line.substr(sp + 1);
                    }
                    return parts;
                };

                SDPUtils.parseSsrcGroup = function(line) {
                    var parts = line.substr(13).split(' ');
                    return {
                        semantics: parts.shift(),
                        ssrcs: parts.map(function(ssrc) {
                            return parseInt(ssrc, 10);
                        })
                    };
                };

                // Extracts the MID (RFC 5888) from a media section.
                // returns the MID or undefined if no mid line was found.
                SDPUtils.getMid = function(mediaSection) {
                    var mid = SDPUtils.matchPrefix(mediaSection, 'a=mid:')[0];
                    if (mid) {
                        return mid.substr(6);
                    }
                };

                SDPUtils.parseFingerprint = function(line) {
                    var parts = line.substr(14).split(' ');
                    return {
                        algorithm: parts[0].toLowerCase(), // algorithm is case-sensitive in Edge.
                        value: parts[1]
                    };
                };

                // Extracts DTLS parameters from SDP media section or sessionpart.
                // FIXME: for consistency with other functions this should only
                //   get the fingerprint line as input. See also getIceParameters.
                SDPUtils.getDtlsParameters = function(mediaSection, sessionpart) {
                    var lines = SDPUtils.matchPrefix(mediaSection + sessionpart,
                        'a=fingerprint:');
                    // Note: a=setup line is ignored since we use the 'auto' role.
                    // Note2: 'algorithm' is not case sensitive except in Edge.
                    return {
                        role: 'auto',
                        fingerprints: lines.map(SDPUtils.parseFingerprint)
                    };
                };

                // Serializes DTLS parameters to SDP.
                SDPUtils.writeDtlsParameters = function(params, setupType) {
                    var sdp = 'a=setup:' + setupType + '\r\n';
                    params.fingerprints.forEach(function(fp) {
                        sdp += 'a=fingerprint:' + fp.algorithm + ' ' + fp.value + '\r\n';
                    });
                    return sdp;
                };

                // Parses a=crypto lines into
                //   https://rawgit.com/aboba/edgertc/master/msortc-rs4.html#dictionary-rtcsrtpsdesparameters-members
                SDPUtils.parseCryptoLine = function(line) {
                    var parts = line.substr(9).split(' ');
                    return {
                        tag: parseInt(parts[0], 10),
                        cryptoSuite: parts[1],
                        keyParams: parts[2],
                        sessionParams: parts.slice(3),
                    };
                };

                SDPUtils.writeCryptoLine = function(parameters) {
                    return 'a=crypto:' + parameters.tag + ' ' +
                        parameters.cryptoSuite + ' ' +
                        (typeof parameters.keyParams === 'object' ?
                            SDPUtils.writeCryptoKeyParams(parameters.keyParams) :
                            parameters.keyParams) +
                        (parameters.sessionParams ? ' ' + parameters.sessionParams.join(' ') : '') +
                        '\r\n';
                };

                // Parses the crypto key parameters into
                //   https://rawgit.com/aboba/edgertc/master/msortc-rs4.html#rtcsrtpkeyparam*
                SDPUtils.parseCryptoKeyParams = function(keyParams) {
                    if (keyParams.indexOf('inline:') !== 0) {
                        return null;
                    }
                    var parts = keyParams.substr(7).split('|');
                    return {
                        keyMethod: 'inline',
                        keySalt: parts[0],
                        lifeTime: parts[1],
                        mkiValue: parts[2] ? parts[2].split(':')[0] : undefined,
                        mkiLength: parts[2] ? parts[2].split(':')[1] : undefined,
                    };
                };

                SDPUtils.writeCryptoKeyParams = function(keyParams) {
                    return keyParams.keyMethod + ':' +
                        keyParams.keySalt +
                        (keyParams.lifeTime ? '|' + keyParams.lifeTime : '') +
                        (keyParams.mkiValue && keyParams.mkiLength ?
                            '|' + keyParams.mkiValue + ':' + keyParams.mkiLength :
                            '');
                };

                // Extracts all SDES paramters.
                SDPUtils.getCryptoParameters = function(mediaSection, sessionpart) {
                    var lines = SDPUtils.matchPrefix(mediaSection + sessionpart,
                        'a=crypto:');
                    return lines.map(SDPUtils.parseCryptoLine);
                };

                // Parses ICE information from SDP media section or sessionpart.
                // FIXME: for consistency with other functions this should only
                //   get the ice-ufrag and ice-pwd lines as input.
                SDPUtils.getIceParameters = function(mediaSection, sessionpart) {
                    var ufrag = SDPUtils.matchPrefix(mediaSection + sessionpart,
                        'a=ice-ufrag:')[0];
                    var pwd = SDPUtils.matchPrefix(mediaSection + sessionpart,
                        'a=ice-pwd:')[0];
                    if (!(ufrag && pwd)) {
                        return null;
                    }
                    return {
                        usernameFragment: ufrag.substr(12),
                        password: pwd.substr(10),
                    };
                };

                // Serializes ICE parameters to SDP.
                SDPUtils.writeIceParameters = function(params) {
                    return 'a=ice-ufrag:' + params.usernameFragment + '\r\n' +
                        'a=ice-pwd:' + params.password + '\r\n';
                };

                // Parses the SDP media section and returns RTCRtpParameters.
                SDPUtils.parseRtpParameters = function(mediaSection) {
                    var description = {
                        codecs: [],
                        headerExtensions: [],
                        fecMechanisms: [],
                        rtcp: []
                    };
                    var lines = SDPUtils.splitLines(mediaSection);
                    var mline = lines[0].split(' ');
                    for (var i = 3; i < mline.length; i++) { // find all codecs from mline[3..]
                        var pt = mline[i];
                        var rtpmapline = SDPUtils.matchPrefix(
                            mediaSection, 'a=rtpmap:' + pt + ' ')[0];
                        if (rtpmapline) {
                            var codec = SDPUtils.parseRtpMap(rtpmapline);
                            var fmtps = SDPUtils.matchPrefix(
                                mediaSection, 'a=fmtp:' + pt + ' ');
                            // Only the first a=fmtp:<pt> is considered.
                            codec.parameters = fmtps.length ? SDPUtils.parseFmtp(fmtps[0]) : {};
                            codec.rtcpFeedback = SDPUtils.matchPrefix(
                                    mediaSection, 'a=rtcp-fb:' + pt + ' ')
                                .map(SDPUtils.parseRtcpFb);
                            description.codecs.push(codec);
                            // parse FEC mechanisms from rtpmap lines.
                            switch (codec.name.toUpperCase()) {
                                case 'RED':
                                case 'ULPFEC':
                                    description.fecMechanisms.push(codec.name.toUpperCase());
                                    break;
                                default: // only RED and ULPFEC are recognized as FEC mechanisms.
                                    break;
                            }
                        }
                    }
                    SDPUtils.matchPrefix(mediaSection, 'a=extmap:').forEach(function(line) {
                        description.headerExtensions.push(SDPUtils.parseExtmap(line));
                    });
                    // FIXME: parse rtcp.
                    return description;
                };

                // Generates parts of the SDP media section describing the capabilities /
                // parameters.
                SDPUtils.writeRtpDescription = function(kind, caps) {
                    var sdp = '';

                    // Build the mline.
                    sdp += 'm=' + kind + ' ';
                    sdp += caps.codecs.length > 0 ? '9' : '0'; // reject if no codecs.
                    sdp += ' UDP/TLS/RTP/SAVPF ';
                    sdp += caps.codecs.map(function(codec) {
                        if (codec.preferredPayloadType !== undefined) {
                            return codec.preferredPayloadType;
                        }
                        return codec.payloadType;
                    }).join(' ') + '\r\n';

                    sdp += 'c=IN IP4 0.0.0.0\r\n';
                    sdp += 'a=rtcp:9 IN IP4 0.0.0.0\r\n';

                    // Add a=rtpmap lines for each codec. Also fmtp and rtcp-fb.
                    caps.codecs.forEach(function(codec) {
                        sdp += SDPUtils.writeRtpMap(codec);
                        sdp += SDPUtils.writeFmtp(codec);
                        sdp += SDPUtils.writeRtcpFb(codec);
                    });
                    var maxptime = 0;
                    caps.codecs.forEach(function(codec) {
                        if (codec.maxptime > maxptime) {
                            maxptime = codec.maxptime;
                        }
                    });
                    if (maxptime > 0) {
                        sdp += 'a=maxptime:' + maxptime + '\r\n';
                    }
                    sdp += 'a=rtcp-mux\r\n';

                    if (caps.headerExtensions) {
                        caps.headerExtensions.forEach(function(extension) {
                            sdp += SDPUtils.writeExtmap(extension);
                        });
                    }
                    // FIXME: write fecMechanisms.
                    return sdp;
                };

                // Parses the SDP media section and returns an array of
                // RTCRtpEncodingParameters.
                SDPUtils.parseRtpEncodingParameters = function(mediaSection) {
                    var encodingParameters = [];
                    var description = SDPUtils.parseRtpParameters(mediaSection);
                    var hasRed = description.fecMechanisms.indexOf('RED') !== -1;
                    var hasUlpfec = description.fecMechanisms.indexOf('ULPFEC') !== -1;

                    // filter a=ssrc:... cname:, ignore PlanB-msid
                    var ssrcs = SDPUtils.matchPrefix(mediaSection, 'a=ssrc:')
                        .map(function(line) {
                            return SDPUtils.parseSsrcMedia(line);
                        })
                        .filter(function(parts) {
                            return parts.attribute === 'cname';
                        });
                    var primarySsrc = ssrcs.length > 0 && ssrcs[0].ssrc;
                    var secondarySsrc;

                    var flows = SDPUtils.matchPrefix(mediaSection, 'a=ssrc-group:FID')
                        .map(function(line) {
                            var parts = line.substr(17).split(' ');
                            return parts.map(function(part) {
                                return parseInt(part, 10);
                            });
                        });
                    if (flows.length > 0 && flows[0].length > 1 && flows[0][0] === primarySsrc) {
                        secondarySsrc = flows[0][1];
                    }

                    description.codecs.forEach(function(codec) {
                        if (codec.name.toUpperCase() === 'RTX' && codec.parameters.apt) {
                            var encParam = {
                                ssrc: primarySsrc,
                                codecPayloadType: parseInt(codec.parameters.apt, 10)
                            };
                            if (primarySsrc && secondarySsrc) {
                                encParam.rtx = {
                                    ssrc: secondarySsrc
                                };
                            }
                            encodingParameters.push(encParam);
                            if (hasRed) {
                                encParam = JSON.parse(JSON.stringify(encParam));
                                encParam.fec = {
                                    ssrc: primarySsrc,
                                    mechanism: hasUlpfec ? 'red+ulpfec' : 'red'
                                };
                                encodingParameters.push(encParam);
                            }
                        }
                    });
                    if (encodingParameters.length === 0 && primarySsrc) {
                        encodingParameters.push({
                            ssrc: primarySsrc
                        });
                    }

                    // we support both b=AS and b=TIAS but interpret AS as TIAS.
                    var bandwidth = SDPUtils.matchPrefix(mediaSection, 'b=');
                    if (bandwidth.length) {
                        if (bandwidth[0].indexOf('b=TIAS:') === 0) {
                            bandwidth = parseInt(bandwidth[0].substr(7), 10);
                        } else if (bandwidth[0].indexOf('b=AS:') === 0) {
                            // use formula from JSEP to convert b=AS to TIAS value.
                            bandwidth = parseInt(bandwidth[0].substr(5), 10) * 1000 * 0.95 -
                                (50 * 40 * 8);
                        } else {
                            bandwidth = undefined;
                        }
                        encodingParameters.forEach(function(params) {
                            params.maxBitrate = bandwidth;
                        });
                    }
                    return encodingParameters;
                };

                // parses http://draft.ortc.org/#rtcrtcpparameters*
                SDPUtils.parseRtcpParameters = function(mediaSection) {
                    var rtcpParameters = {};

                    // Gets the first SSRC. Note tha with RTX there might be multiple
                    // SSRCs.
                    var remoteSsrc = SDPUtils.matchPrefix(mediaSection, 'a=ssrc:')
                        .map(function(line) {
                            return SDPUtils.parseSsrcMedia(line);
                        })
                        .filter(function(obj) {
                            return obj.attribute === 'cname';
                        })[0];
                    if (remoteSsrc) {
                        rtcpParameters.cname = remoteSsrc.value;
                        rtcpParameters.ssrc = remoteSsrc.ssrc;
                    }

                    // Edge uses the compound attribute instead of reducedSize
                    // compound is !reducedSize
                    var rsize = SDPUtils.matchPrefix(mediaSection, 'a=rtcp-rsize');
                    rtcpParameters.reducedSize = rsize.length > 0;
                    rtcpParameters.compound = rsize.length === 0;

                    // parses the rtcp-mux attrіbute.
                    // Note that Edge does not support unmuxed RTCP.
                    var mux = SDPUtils.matchPrefix(mediaSection, 'a=rtcp-mux');
                    rtcpParameters.mux = mux.length > 0;

                    return rtcpParameters;
                };

                // parses either a=msid: or a=ssrc:... msid lines and returns
                // the id of the MediaStream and MediaStreamTrack.
                SDPUtils.parseMsid = function(mediaSection) {
                    var parts;
                    var spec = SDPUtils.matchPrefix(mediaSection, 'a=msid:');
                    if (spec.length === 1) {
                        parts = spec[0].substr(7).split(' ');
                        return {
                            stream: parts[0],
                            track: parts[1]
                        };
                    }
                    var planB = SDPUtils.matchPrefix(mediaSection, 'a=ssrc:')
                        .map(function(line) {
                            return SDPUtils.parseSsrcMedia(line);
                        })
                        .filter(function(msidParts) {
                            return msidParts.attribute === 'msid';
                        });
                    if (planB.length > 0) {
                        parts = planB[0].value.split(' ');
                        return {
                            stream: parts[0],
                            track: parts[1]
                        };
                    }
                };

                // SCTP
                // parses draft-ietf-mmusic-sctp-sdp-26 first and falls back
                // to draft-ietf-mmusic-sctp-sdp-05
                SDPUtils.parseSctpDescription = function(mediaSection) {
                    var mline = SDPUtils.parseMLine(mediaSection);
                    var maxSizeLine = SDPUtils.matchPrefix(mediaSection, 'a=max-message-size:');
                    var maxMessageSize;
                    if (maxSizeLine.length > 0) {
                        maxMessageSize = parseInt(maxSizeLine[0].substr(19), 10);
                    }
                    if (isNaN(maxMessageSize)) {
                        maxMessageSize = 65536;
                    }
                    var sctpPort = SDPUtils.matchPrefix(mediaSection, 'a=sctp-port:');
                    if (sctpPort.length > 0) {
                        return {
                            port: parseInt(sctpPort[0].substr(12), 10),
                            protocol: mline.fmt,
                            maxMessageSize: maxMessageSize
                        };
                    }
                    var sctpMapLines = SDPUtils.matchPrefix(mediaSection, 'a=sctpmap:');
                    if (sctpMapLines.length > 0) {
                        var parts = SDPUtils.matchPrefix(mediaSection, 'a=sctpmap:')[0]
                            .substr(10)
                            .split(' ');
                        return {
                            port: parseInt(parts[0], 10),
                            protocol: parts[1],
                            maxMessageSize: maxMessageSize
                        };
                    }
                };

                // SCTP
                // outputs the draft-ietf-mmusic-sctp-sdp-26 version that all browsers
                // support by now receiving in this format, unless we originally parsed
                // as the draft-ietf-mmusic-sctp-sdp-05 format (indicated by the m-line
                // protocol of DTLS/SCTP -- without UDP/ or TCP/)
                SDPUtils.writeSctpDescription = function(media, sctp) {
                    var output = [];
                    if (media.protocol !== 'DTLS/SCTP') {
                        output = [
                            'm=' + media.kind + ' 9 ' + media.protocol + ' ' + sctp.protocol + '\r\n',
                            'c=IN IP4 0.0.0.0\r\n',
                            'a=sctp-port:' + sctp.port + '\r\n'
                        ];
                    } else {
                        output = [
                            'm=' + media.kind + ' 9 ' + media.protocol + ' ' + sctp.port + '\r\n',
                            'c=IN IP4 0.0.0.0\r\n',
                            'a=sctpmap:' + sctp.port + ' ' + sctp.protocol + ' 65535\r\n'
                        ];
                    }
                    if (sctp.maxMessageSize !== undefined) {
                        output.push('a=max-message-size:' + sctp.maxMessageSize + '\r\n');
                    }
                    return output.join('');
                };

                // Generate a session ID for SDP.
                // https://tools.ietf.org/html/draft-ietf-rtcweb-jsep-20#section-5.2.1
                // recommends using a cryptographically random +ve 64-bit value
                // but right now this should be acceptable and within the right range
                SDPUtils.generateSessionId = function() {
                    return Math.random().toString().substr(2, 21);
                };

                // Write boilder plate for start of SDP
                // sessId argument is optional - if not supplied it will
                // be generated randomly
                // sessVersion is optional and defaults to 2
                // sessUser is optional and defaults to 'thisisadapterortc'
                SDPUtils.writeSessionBoilerplate = function(sessId, sessVer, sessUser) {
                    var sessionId;
                    var version = sessVer !== undefined ? sessVer : 2;
                    if (sessId) {
                        sessionId = sessId;
                    } else {
                        sessionId = SDPUtils.generateSessionId();
                    }
                    var user = sessUser || 'thisisadapterortc';
                    // FIXME: sess-id should be an NTP timestamp.
                    return 'v=0\r\n' +
                        'o=' + user + ' ' + sessionId + ' ' + version +
                        ' IN IP4 127.0.0.1\r\n' +
                        's=-\r\n' +
                        't=0 0\r\n';
                };

                SDPUtils.writeMediaSection = function(transceiver, caps, type, stream) {
                    var sdp = SDPUtils.writeRtpDescription(transceiver.kind, caps);

                    // Map ICE parameters (ufrag, pwd) to SDP.
                    sdp += SDPUtils.writeIceParameters(
                        transceiver.iceGatherer.getLocalParameters());

                    // Map DTLS parameters to SDP.
                    sdp += SDPUtils.writeDtlsParameters(
                        transceiver.dtlsTransport.getLocalParameters(),
                        type === 'offer' ? 'actpass' : 'active');

                    sdp += 'a=mid:' + transceiver.mid + '\r\n';

                    if (transceiver.direction) {
                        sdp += 'a=' + transceiver.direction + '\r\n';
                    } else if (transceiver.rtpSender && transceiver.rtpReceiver) {
                        sdp += 'a=sendrecv\r\n';
                    } else if (transceiver.rtpSender) {
                        sdp += 'a=sendonly\r\n';
                    } else if (transceiver.rtpReceiver) {
                        sdp += 'a=recvonly\r\n';
                    } else {
                        sdp += 'a=inactive\r\n';
                    }

                    if (transceiver.rtpSender) {
                        // spec.
                        var msid = 'msid:' + stream.id + ' ' +
                            transceiver.rtpSender.track.id + '\r\n';
                        sdp += 'a=' + msid;

                        // for Chrome.
                        sdp += 'a=ssrc:' + transceiver.sendEncodingParameters[0].ssrc +
                            ' ' + msid;
                        if (transceiver.sendEncodingParameters[0].rtx) {
                            sdp += 'a=ssrc:' + transceiver.sendEncodingParameters[0].rtx.ssrc +
                                ' ' + msid;
                            sdp += 'a=ssrc-group:FID ' +
                                transceiver.sendEncodingParameters[0].ssrc + ' ' +
                                transceiver.sendEncodingParameters[0].rtx.ssrc +
                                '\r\n';
                        }
                    }
                    // FIXME: this should be written by writeRtpDescription.
                    sdp += 'a=ssrc:' + transceiver.sendEncodingParameters[0].ssrc +
                        ' cname:' + SDPUtils.localCName + '\r\n';
                    if (transceiver.rtpSender && transceiver.sendEncodingParameters[0].rtx) {
                        sdp += 'a=ssrc:' + transceiver.sendEncodingParameters[0].rtx.ssrc +
                            ' cname:' + SDPUtils.localCName + '\r\n';
                    }
                    return sdp;
                };

                // Gets the direction from the mediaSection or the sessionpart.
                SDPUtils.getDirection = function(mediaSection, sessionpart) {
                    // Look for sendrecv, sendonly, recvonly, inactive, default to sendrecv.
                    var lines = SDPUtils.splitLines(mediaSection);
                    for (var i = 0; i < lines.length; i++) {
                        switch (lines[i]) {
                            case 'a=sendrecv':
                            case 'a=sendonly':
                            case 'a=recvonly':
                            case 'a=inactive':
                                return lines[i].substr(2);
                            default:
                                // FIXME: What should happen here?
                        }
                    }
                    if (sessionpart) {
                        return SDPUtils.getDirection(sessionpart);
                    }
                    return 'sendrecv';
                };

                SDPUtils.getKind = function(mediaSection) {
                    var lines = SDPUtils.splitLines(mediaSection);
                    var mline = lines[0].split(' ');
                    return mline[0].substr(2);
                };

                SDPUtils.isRejected = function(mediaSection) {
                    return mediaSection.split(' ', 2)[1] === '0';
                };

                SDPUtils.parseMLine = function(mediaSection) {
                    var lines = SDPUtils.splitLines(mediaSection);
                    var parts = lines[0].substr(2).split(' ');
                    return {
                        kind: parts[0],
                        port: parseInt(parts[1], 10),
                        protocol: parts[2],
                        fmt: parts.slice(3).join(' ')
                    };
                };

                SDPUtils.parseOLine = function(mediaSection) {
                    var line = SDPUtils.matchPrefix(mediaSection, 'o=')[0];
                    var parts = line.substr(2).split(' ');
                    return {
                        username: parts[0],
                        sessionId: parts[1],
                        sessionVersion: parseInt(parts[2], 10),
                        netType: parts[3],
                        addressType: parts[4],
                        address: parts[5]
                    };
                };

                // a very naive interpretation of a valid SDP.
                SDPUtils.isValidSDP = function(blob) {
                    if (typeof blob !== 'string' || blob.length === 0) {
                        return false;
                    }
                    var lines = SDPUtils.splitLines(blob);
                    for (var i = 0; i < lines.length; i++) {
                        if (lines[i].length < 2 || lines[i].charAt(1) !== '=') {
                            return false;
                        }
                        // TODO: check the modifier a bit more.
                    }
                    return true;
                };

                // Expose public methods.
                if (typeof module === 'object') {
                    module.exports = SDPUtils;
                }

            }, {}]
        }, {}, [1])(1)
    });

    'use strict';
/*!
* Last Updated On: 2020-03-23 2:31:22 AM UTC

* ________________
* DetectRTC v1.4.0

* Open-Sourced: https://github.com/muaz-khan/DetectRTC

* --------------------------------------------------
* Muaz Khan     - www.MuazKhan.com
* MIT License   - www.WebRTC-Experiment.com/licence
* --------------------------------------------------
*/
    (function() {

        var browserFakeUserAgent = 'Fake/5.0 (FakeOS) AppleWebKit/123 (KHTML, like Gecko) Fake/12.3.4567.89 Fake/123.45';

        var isNodejs = typeof process === 'object' && typeof process.versions === 'object' && process.versions.node && /*node-process*/ !process.browser;
        if (isNodejs) {
            var version = process.versions.node.toString().replace('v', '');
            browserFakeUserAgent = 'Nodejs/' + version + ' (NodeOS) AppleWebKit/' + version + ' (KHTML, like Gecko) Nodejs/' + version + ' Nodejs/' + version
        }

        (function(that) {
            if (typeof window !== 'undefined') {
                return;
            }

            if (typeof window === 'undefined' && typeof global !== 'undefined') {
                global.navigator = {
                    userAgent: browserFakeUserAgent,
                    getUserMedia: function() {}
                };

                /*global window:true */
                that.window = global;
            } else if (typeof window === 'undefined') {
                // window = this;
            }

            if (typeof location === 'undefined') {
                /*global location:true */
                that.location = {
                    protocol: 'file:',
                    href: '',
                    hash: ''
                };
            }

            if (typeof screen === 'undefined') {
                /*global screen:true */
                that.screen = {
                    width: 0,
                    height: 0
                };
            }
        })(typeof global !== 'undefined' ? global : window);

        /*global navigator:true */
        var navigator = window.navigator;

        if (typeof navigator !== 'undefined') {
            if (typeof navigator.webkitGetUserMedia !== 'undefined') {
                navigator.getUserMedia = navigator.webkitGetUserMedia;
            }

            if (typeof navigator.mozGetUserMedia !== 'undefined') {
                navigator.getUserMedia = navigator.mozGetUserMedia;
            }
        } else {
            navigator = {
                getUserMedia: function() {},
                userAgent: browserFakeUserAgent
            };
        }

        var isMobileDevice = !!(/Android|webOS|iPhone|iPad|iPod|BB10|BlackBerry|IEMobile|Opera Mini|Mobile|mobile/i.test(navigator.userAgent || ''));

        var isEdge = navigator.userAgent.indexOf('Edge') !== -1 && (!!navigator.msSaveOrOpenBlob || !!navigator.msSaveBlob);

        var isOpera = !!window.opera || navigator.userAgent.indexOf(' OPR/') >= 0;
        var isFirefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1 && ('netscape' in window) && / rv:/.test(navigator.userAgent);
        var isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
        var isChrome = !!window.chrome && !isOpera;
        var isIE = typeof document !== 'undefined' && !!document.documentMode && !isEdge;

        // this one can also be used:
        // https://www.websocket.org/js/stuff.js (DetectBrowser.js)

        function getBrowserInfo() {
            var nVer = navigator.appVersion;
            var nAgt = navigator.userAgent;
            var browserName = navigator.appName;
            var fullVersion = '' + parseFloat(navigator.appVersion);
            var majorVersion = parseInt(navigator.appVersion, 10);
            var nameOffset, verOffset, ix;

            // In Opera, the true version is after 'Opera' or after 'Version'
            if (isOpera) {
                browserName = 'Opera';
                try {
                    fullVersion = navigator.userAgent.split('OPR/')[1].split(' ')[0];
                    majorVersion = fullVersion.split('.')[0];
                } catch (e) {
                    fullVersion = '0.0.0.0';
                    majorVersion = 0;
                }
            }
            // In MSIE version <=10, the true version is after 'MSIE' in userAgent
            // In IE 11, look for the string after 'rv:'
            else if (isIE) {
                verOffset = nAgt.indexOf('rv:');
                if (verOffset > 0) { //IE 11
                    fullVersion = nAgt.substring(verOffset + 3);
                } else { //IE 10 or earlier
                    verOffset = nAgt.indexOf('MSIE');
                    fullVersion = nAgt.substring(verOffset + 5);
                }
                browserName = 'IE';
            }
            // In Chrome, the true version is after 'Chrome' 
            else if (isChrome) {
                verOffset = nAgt.indexOf('Chrome');
                browserName = 'Chrome';
                fullVersion = nAgt.substring(verOffset + 7);
            }
            // In Safari, the true version is after 'Safari' or after 'Version' 
            else if (isSafari) {
                // both and safri and chrome has same userAgent
                if (nAgt.indexOf('CriOS') !== -1) {
                    verOffset = nAgt.indexOf('CriOS');
                    browserName = 'Chrome';
                    fullVersion = nAgt.substring(verOffset + 6);
                } else if (nAgt.indexOf('FxiOS') !== -1) {
                    verOffset = nAgt.indexOf('FxiOS');
                    browserName = 'Firefox';
                    fullVersion = nAgt.substring(verOffset + 6);
                } else {
                    verOffset = nAgt.indexOf('Safari');

                    browserName = 'Safari';
                    fullVersion = nAgt.substring(verOffset + 7);

                    if ((verOffset = nAgt.indexOf('Version')) !== -1) {
                        fullVersion = nAgt.substring(verOffset + 8);
                    }

                    if (navigator.userAgent.indexOf('Version/') !== -1) {
                        fullVersion = navigator.userAgent.split('Version/')[1].split(' ')[0];
                    }
                }
            }
            // In Firefox, the true version is after 'Firefox' 
            else if (isFirefox) {
                verOffset = nAgt.indexOf('Firefox');
                browserName = 'Firefox';
                fullVersion = nAgt.substring(verOffset + 8);
            }

            // In most other browsers, 'name/version' is at the end of userAgent 
            else if ((nameOffset = nAgt.lastIndexOf(' ') + 1) < (verOffset = nAgt.lastIndexOf('/'))) {
                browserName = nAgt.substring(nameOffset, verOffset);
                fullVersion = nAgt.substring(verOffset + 1);

                if (browserName.toLowerCase() === browserName.toUpperCase()) {
                    browserName = navigator.appName;
                }
            }

            if (isEdge) {
                browserName = 'Edge';
                fullVersion = navigator.userAgent.split('Edge/')[1];
                // fullVersion = parseInt(navigator.userAgent.match(/Edge\/(\d+).(\d+)$/)[2], 10).toString();
            }

            // trim the fullVersion string at semicolon/space/bracket if present
            if ((ix = fullVersion.search(/[; \)]/)) !== -1) {
                fullVersion = fullVersion.substring(0, ix);
            }

            majorVersion = parseInt('' + fullVersion, 10);

            if (isNaN(majorVersion)) {
                fullVersion = '' + parseFloat(navigator.appVersion);
                majorVersion = parseInt(navigator.appVersion, 10);
            }

            return {
                fullVersion: fullVersion,
                version: majorVersion,
                name: browserName,
                isPrivateBrowsing: false
            };
        }

        // via: https://gist.github.com/cou929/7973956

        function retry(isDone, next) {
            var currentTrial = 0,
                maxRetry = 50,
                interval = 10,
                isTimeout = false;
            var id = window.setInterval(
                function() {
                    if (isDone()) {
                        window.clearInterval(id);
                        next(isTimeout);
                    }
                    if (currentTrial++ > maxRetry) {
                        window.clearInterval(id);
                        isTimeout = true;
                        next(isTimeout);
                    }
                },
                10
            );
        }

        function isIE10OrLater(userAgent) {
            var ua = userAgent.toLowerCase();
            if (ua.indexOf('msie') === 0 && ua.indexOf('trident') === 0) {
                return false;
            }
            var match = /(?:msie|rv:)\s?([\d\.]+)/.exec(ua);
            if (match && parseInt(match[1], 10) >= 10) {
                return true;
            }
            return false;
        }

        function detectPrivateMode(callback) {
            var isPrivate;

            try {

                if (window.webkitRequestFileSystem) {
                    window.webkitRequestFileSystem(
                        window.TEMPORARY, 1,
                        function() {
                            isPrivate = false;
                        },
                        function(e) {
                            isPrivate = true;
                        }
                    );
                } else if (window.indexedDB && /Firefox/.test(window.navigator.userAgent)) {
                    var db;
                    try {
                        db = window.indexedDB.open('test');
                        db.onerror = function() {
                            return true;
                        };
                    } catch (e) {
                        isPrivate = true;
                    }

                    if (typeof isPrivate === 'undefined') {
                        retry(
                            function isDone() {
                                return db.readyState === 'done' ? true : false;
                            },
                            function next(isTimeout) {
                                if (!isTimeout) {
                                    isPrivate = db.result ? false : true;
                                }
                            }
                        );
                    }
                } else if (isIE10OrLater(window.navigator.userAgent)) {
                    isPrivate = false;
                    try {
                        if (!window.indexedDB) {
                            isPrivate = true;
                        }
                    } catch (e) {
                        isPrivate = true;
                    }
                } else if (window.localStorage && /Safari/.test(window.navigator.userAgent)) {
                    try {
                        window.localStorage.setItem('test', 1);
                    } catch (e) {
                        isPrivate = true;
                    }

                    if (typeof isPrivate === 'undefined') {
                        isPrivate = false;
                        window.localStorage.removeItem('test');
                    }
                }

            } catch (e) {
                isPrivate = false;
            }

            retry(
                function isDone() {
                    return typeof isPrivate !== 'undefined' ? true : false;
                },
                function next(isTimeout) {
                    callback(isPrivate);
                }
            );
        }

        var isMobile = {
            Android: function() {
                return navigator.userAgent.match(/Android/i);
            },
            BlackBerry: function() {
                return navigator.userAgent.match(/BlackBerry|BB10/i);
            },
            iOS: function() {
                return navigator.userAgent.match(/iPhone|iPad|iPod/i);
            },
            Opera: function() {
                return navigator.userAgent.match(/Opera Mini/i);
            },
            Windows: function() {
                return navigator.userAgent.match(/IEMobile/i);
            },
            any: function() {
                return (isMobile.Android() || isMobile.BlackBerry() || isMobile.iOS() || isMobile.Opera() || isMobile.Windows());
            },
            getOsName: function() {
                var osName = 'Unknown OS';
                if (isMobile.Android()) {
                    osName = 'Android';
                }

                if (isMobile.BlackBerry()) {
                    osName = 'BlackBerry';
                }

                if (isMobile.iOS()) {
                    osName = 'iOS';
                }

                if (isMobile.Opera()) {
                    osName = 'Opera Mini';
                }

                if (isMobile.Windows()) {
                    osName = 'Windows';
                }

                return osName;
            }
        };

        // via: http://jsfiddle.net/ChristianL/AVyND/
        function detectDesktopOS() {
            var unknown = '-';

            var nVer = navigator.appVersion;
            var nAgt = navigator.userAgent;

            var os = unknown;
            var clientStrings = [{
                s: 'Chrome OS',
                r: /CrOS/
            }, {
                s: 'Windows 10',
                r: /(Windows 10.0|Windows NT 10.0)/
            }, {
                s: 'Windows 8.1',
                r: /(Windows 8.1|Windows NT 6.3)/
            }, {
                s: 'Windows 8',
                r: /(Windows 8|Windows NT 6.2)/
            }, {
                s: 'Windows 7',
                r: /(Windows 7|Windows NT 6.1)/
            }, {
                s: 'Windows Vista',
                r: /Windows NT 6.0/
            }, {
                s: 'Windows Server 2003',
                r: /Windows NT 5.2/
            }, {
                s: 'Windows XP',
                r: /(Windows NT 5.1|Windows XP)/
            }, {
                s: 'Windows 2000',
                r: /(Windows NT 5.0|Windows 2000)/
            }, {
                s: 'Windows ME',
                r: /(Win 9x 4.90|Windows ME)/
            }, {
                s: 'Windows 98',
                r: /(Windows 98|Win98)/
            }, {
                s: 'Windows 95',
                r: /(Windows 95|Win95|Windows_95)/
            }, {
                s: 'Windows NT 4.0',
                r: /(Windows NT 4.0|WinNT4.0|WinNT|Windows NT)/
            }, {
                s: 'Windows CE',
                r: /Windows CE/
            }, {
                s: 'Windows 3.11',
                r: /Win16/
            }, {
                s: 'Android',
                r: /Android/
            }, {
                s: 'Open BSD',
                r: /OpenBSD/
            }, {
                s: 'Sun OS',
                r: /SunOS/
            }, {
                s: 'Linux',
                r: /(Linux|X11)/
            }, {
                s: 'iOS',
                r: /(iPhone|iPad|iPod)/
            }, {
                s: 'Mac OS X',
                r: /Mac OS X/
            }, {
                s: 'Mac OS',
                r: /(MacPPC|MacIntel|Mac_PowerPC|Macintosh)/
            }, {
                s: 'QNX',
                r: /QNX/
            }, {
                s: 'UNIX',
                r: /UNIX/
            }, {
                s: 'BeOS',
                r: /BeOS/
            }, {
                s: 'OS/2',
                r: /OS\/2/
            }, {
                s: 'Search Bot',
                r: /(nuhk|Googlebot|Yammybot|Openbot|Slurp|MSNBot|Ask Jeeves\/Teoma|ia_archiver)/
            }];
            for (var i = 0, cs; cs = clientStrings[i]; i++) {
                if (cs.r.test(nAgt)) {
                    os = cs.s;
                    break;
                }
            }

            var osVersion = unknown;

            if (/Windows/.test(os)) {
                if (/Windows (.*)/.test(os)) {
                    osVersion = /Windows (.*)/.exec(os)[1];
                }
                os = 'Windows';
            }

            switch (os) {
                case 'Mac OS X':
                    if (/Mac OS X (10[\.\_\d]+)/.test(nAgt)) {
                        osVersion = /Mac OS X (10[\.\_\d]+)/.exec(nAgt)[1];
                    }
                    break;
                case 'Android':
                    if (/Android ([\.\_\d]+)/.test(nAgt)) {
                        osVersion = /Android ([\.\_\d]+)/.exec(nAgt)[1];
                    }
                    break;
                case 'iOS':
                    if (/OS (\d+)_(\d+)_?(\d+)?/.test(nAgt)) {
                        osVersion = /OS (\d+)_(\d+)_?(\d+)?/.exec(nVer);
                        osVersion = osVersion[1] + '.' + osVersion[2] + '.' + (osVersion[3] | 0);
                    }
                    break;
            }

            return {
                osName: os,
                osVersion: osVersion
            };
        }

        var osName = 'Unknown OS';
        var osVersion = 'Unknown OS Version';

        function getAndroidVersion(ua) {
            ua = (ua || navigator.userAgent).toLowerCase();
            var match = ua.match(/android\s([0-9\.]*)/);
            return match ? match[1] : false;
        }

        var osInfo = detectDesktopOS();

        if (osInfo && osInfo.osName && osInfo.osName != '-') {
            osName = osInfo.osName;
            osVersion = osInfo.osVersion;
        } else if (isMobile.any()) {
            osName = isMobile.getOsName();

            if (osName == 'Android') {
                osVersion = getAndroidVersion();
            }
        }

        var isNodejs = typeof process === 'object' && typeof process.versions === 'object' && process.versions.node;

        if (osName === 'Unknown OS' && isNodejs) {
            osName = 'Nodejs';
            osVersion = process.versions.node.toString().replace('v', '');
        }

        var isCanvasSupportsStreamCapturing = false;
        var isVideoSupportsStreamCapturing = false;
        ['captureStream', 'mozCaptureStream', 'webkitCaptureStream'].forEach(function(item) {
            if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
                return;
            }

            if (!isCanvasSupportsStreamCapturing && item in document.createElement('canvas')) {
                isCanvasSupportsStreamCapturing = true;
            }

            if (!isVideoSupportsStreamCapturing && item in document.createElement('video')) {
                isVideoSupportsStreamCapturing = true;
            }
        });

        var regexIpv4Local = /^(192\.168\.|169\.254\.|10\.|172\.(1[6-9]|2\d|3[01]))/,
            regexIpv4 = /([0-9]{1,3}(\.[0-9]{1,3}){3})/,
            regexIpv6 = /[a-f0-9]{1,4}(:[a-f0-9]{1,4}){7}/;

        // via: https://github.com/diafygi/webrtc-ips
        function DetectLocalIPAddress(callback, stream) {
            if (!DetectRTC.isWebRTCSupported) {
                return;
            }

            var isPublic = true,
                isIpv4 = true;
            getIPs(function(ip) {
                if (!ip) {
                    callback(); // Pass nothing to tell that ICE-gathering-ended
                } else if (ip.match(regexIpv4Local)) {
                    isPublic = false;
                    callback('Local: ' + ip, isPublic, isIpv4);
                } else if (ip.match(regexIpv6)) { //via https://ourcodeworld.com/articles/read/257/how-to-get-the-client-ip-address-with-javascript-only
                    isIpv4 = false;
                    callback('Public: ' + ip, isPublic, isIpv4);
                } else {
                    callback('Public: ' + ip, isPublic, isIpv4);
                }
            }, stream);
        }

        function getIPs(callback, stream) {
            if (typeof document === 'undefined' || typeof document.getElementById !== 'function') {
                return;
            }

            var ipDuplicates = {};

            var RTCPeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection;

            if (!RTCPeerConnection) {
                var iframe = document.getElementById('iframe');
                if (!iframe) {
                    return;
                }
                var win = iframe.contentWindow;
                RTCPeerConnection = win.RTCPeerConnection || win.mozRTCPeerConnection || win.webkitRTCPeerConnection;
            }

            if (!RTCPeerConnection) {
                return;
            }

            var peerConfig = null;

            if (DetectRTC.browser === 'Chrome' && DetectRTC.browser.version < 58) {
                // todo: add support for older Opera
                peerConfig = {
                    optional: [{
                        RtpDataChannels: true
                    }]
                };
            }

            var servers = {
                iceServers: [{
                    urls: 'stun:stun.l.google.com:19302'
                }]
            };

            var pc = new RTCPeerConnection(servers, peerConfig);

            if (stream) {
                if (pc.addStream) {
                    pc.addStream(stream);
                } else if (pc.addTrack && stream.getTracks()[0]) {
                    pc.addTrack(stream.getTracks()[0], stream);
                }
            }

            function handleCandidate(candidate) {
                if (!candidate) {
                    callback(); // Pass nothing to tell that ICE-gathering-ended
                    return;
                }

                var match = regexIpv4.exec(candidate);
                if (!match) {
                    return;
                }
                var ipAddress = match[1];
                var isPublic = (candidate.match(regexIpv4Local)),
                    isIpv4 = true;

                if (ipDuplicates[ipAddress] === undefined) {
                    callback(ipAddress, isPublic, isIpv4);
                }

                ipDuplicates[ipAddress] = true;
            }

            // listen for candidate events
            pc.onicecandidate = function(event) {
                if (event.candidate && event.candidate.candidate) {
                    handleCandidate(event.candidate.candidate);
                } else {
                    handleCandidate(); // Pass nothing to tell that ICE-gathering-ended
                }
            };

            // create data channel
            if (!stream) {
                try {
                    pc.createDataChannel('sctp', {});
                } catch (e) {}
            }

            // create an offer sdp
            if (DetectRTC.isPromisesSupported) {
                pc.createOffer().then(function(result) {
                    pc.setLocalDescription(result).then(afterCreateOffer);
                });
            } else {
                pc.createOffer(function(result) {
                    pc.setLocalDescription(result, afterCreateOffer, function() {});
                }, function() {});
            }

            function afterCreateOffer() {
                var lines = pc.localDescription.sdp.split('\n');

                lines.forEach(function(line) {
                    if (line && line.indexOf('a=candidate:') === 0) {
                        handleCandidate(line);
                    }
                });
            }
        }

        var MediaDevices = [];

        var audioInputDevices = [];
        var audioOutputDevices = [];
        var videoInputDevices = [];

        if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
            // Firefox 38+ seems having support of enumerateDevices
            // Thanks @xdumaine/enumerateDevices
            navigator.enumerateDevices = function(callback) {
                var enumerateDevices = navigator.mediaDevices.enumerateDevices();
                if (enumerateDevices && enumerateDevices.then) {
                    navigator.mediaDevices.enumerateDevices().then(callback).catch(function() {
                        callback([]);
                    });
                } else {
                    callback([]);
                }
            };
        }

        // Media Devices detection
        var canEnumerate = false;

        /*global MediaStreamTrack:true */
        if (typeof MediaStreamTrack !== 'undefined' && 'getSources' in MediaStreamTrack) {
            canEnumerate = true;
        } else if (navigator.mediaDevices && !!navigator.mediaDevices.enumerateDevices) {
            canEnumerate = true;
        }

        var hasMicrophone = false;
        var hasSpeakers = false;
        var hasWebcam = false;

        var isWebsiteHasMicrophonePermissions = false;
        var isWebsiteHasWebcamPermissions = false;

        // http://dev.w3.org/2011/webrtc/editor/getusermedia.html#mediadevices
        function checkDeviceSupport(callback) {
            if (!canEnumerate) {
                if (callback) {
                    callback();
                }
                return;
            }

            if (!navigator.enumerateDevices && window.MediaStreamTrack && window.MediaStreamTrack.getSources) {
                navigator.enumerateDevices = window.MediaStreamTrack.getSources.bind(window.MediaStreamTrack);
            }

            if (!navigator.enumerateDevices && navigator.enumerateDevices) {
                navigator.enumerateDevices = navigator.enumerateDevices.bind(navigator);
            }

            if (!navigator.enumerateDevices) {
                if (callback) {
                    callback();
                }
                return;
            }

            MediaDevices = [];

            audioInputDevices = [];
            audioOutputDevices = [];
            videoInputDevices = [];

            hasMicrophone = false;
            hasSpeakers = false;
            hasWebcam = false;

            isWebsiteHasMicrophonePermissions = false;
            isWebsiteHasWebcamPermissions = false;

            // to prevent duplication
            var alreadyUsedDevices = {};

            navigator.enumerateDevices(function(devices) {
                MediaDevices = [];

                audioInputDevices = [];
                audioOutputDevices = [];
                videoInputDevices = [];

                devices.forEach(function(_device) {
                    var device = {};
                    for (var d in _device) {
                        try {
                            if (typeof _device[d] !== 'function') {
                                device[d] = _device[d];
                            }
                        } catch (e) {}
                    }

                    if (alreadyUsedDevices[device.deviceId + device.label + device.kind]) {
                        return;
                    }

                    // if it is MediaStreamTrack.getSources
                    if (device.kind === 'audio') {
                        device.kind = 'audioinput';
                    }

                    if (device.kind === 'video') {
                        device.kind = 'videoinput';
                    }

                    if (!device.deviceId) {
                        device.deviceId = device.id;
                    }

                    if (!device.id) {
                        device.id = device.deviceId;
                    }

                    if (!device.label) {
                        device.isCustomLabel = true;

                        if (device.kind === 'videoinput') {
                            device.label = 'Camera ' + (videoInputDevices.length + 1);
                        } else if (device.kind === 'audioinput') {
                            device.label = 'Microphone ' + (audioInputDevices.length + 1);
                        } else if (device.kind === 'audiooutput') {
                            device.label = 'Speaker ' + (audioOutputDevices.length + 1);
                        } else {
                            device.label = 'Please invoke getUserMedia once.';
                        }

                        if (typeof DetectRTC !== 'undefined' && DetectRTC.browser.isChrome && DetectRTC.browser.version >= 46 && !/^(https:|chrome-extension:)$/g.test(location.protocol || '')) {
                            if (typeof document !== 'undefined' && typeof document.domain === 'string' && document.domain.search && document.domain.search(/localhost|127.0./g) === -1) {
                                device.label = 'HTTPs is required to get label of this ' + device.kind + ' device.';
                            }
                        }
                    } else {
                        // Firefox on Android still returns empty label
                        if (device.kind === 'videoinput' && !isWebsiteHasWebcamPermissions) {
                            isWebsiteHasWebcamPermissions = true;
                        }

                        if (device.kind === 'audioinput' && !isWebsiteHasMicrophonePermissions) {
                            isWebsiteHasMicrophonePermissions = true;
                        }
                    }

                    if (device.kind === 'audioinput') {
                        hasMicrophone = true;

                        if (audioInputDevices.indexOf(device) === -1) {
                            audioInputDevices.push(device);
                        }
                    }

                    if (device.kind === 'audiooutput') {
                        hasSpeakers = true;

                        if (audioOutputDevices.indexOf(device) === -1) {
                            audioOutputDevices.push(device);
                        }
                    }

                    if (device.kind === 'videoinput') {
                        hasWebcam = true;

                        if (videoInputDevices.indexOf(device) === -1) {
                            videoInputDevices.push(device);
                        }
                    }

                    // there is no 'videoouput' in the spec.
                    MediaDevices.push(device);

                    alreadyUsedDevices[device.deviceId + device.label + device.kind] = device;
                });

                if (typeof DetectRTC !== 'undefined') {
                    // to sync latest outputs
                    DetectRTC.MediaDevices = MediaDevices;
                    DetectRTC.hasMicrophone = hasMicrophone;
                    DetectRTC.hasSpeakers = hasSpeakers;
                    DetectRTC.hasWebcam = hasWebcam;

                    DetectRTC.isWebsiteHasWebcamPermissions = isWebsiteHasWebcamPermissions;
                    DetectRTC.isWebsiteHasMicrophonePermissions = isWebsiteHasMicrophonePermissions;

                    DetectRTC.audioInputDevices = audioInputDevices;
                    DetectRTC.audioOutputDevices = audioOutputDevices;
                    DetectRTC.videoInputDevices = videoInputDevices;
                }

                if (callback) {
                    callback();
                }
            });
        }

        var DetectRTC = window.DetectRTC || {};

        // ----------
        // DetectRTC.browser.name || DetectRTC.browser.version || DetectRTC.browser.fullVersion
        DetectRTC.browser = getBrowserInfo();

        detectPrivateMode(function(isPrivateBrowsing) {
            DetectRTC.browser.isPrivateBrowsing = !!isPrivateBrowsing;
        });

        // DetectRTC.isChrome || DetectRTC.isFirefox || DetectRTC.isEdge
        DetectRTC.browser['is' + DetectRTC.browser.name] = true;

        // -----------
        DetectRTC.osName = osName;
        DetectRTC.osVersion = osVersion;

        var isNodeWebkit = typeof process === 'object' && typeof process.versions === 'object' && process.versions['node-webkit'];

        // --------- Detect if system supports WebRTC 1.0 or WebRTC 1.1.
        var isWebRTCSupported = false;
        ['RTCPeerConnection', 'webkitRTCPeerConnection', 'mozRTCPeerConnection', 'RTCIceGatherer'].forEach(function(item) {
            if (isWebRTCSupported) {
                return;
            }

            if (item in window) {
                isWebRTCSupported = true;
            }
        });
        DetectRTC.isWebRTCSupported = isWebRTCSupported;

        //-------
        DetectRTC.isORTCSupported = typeof RTCIceGatherer !== 'undefined';

        // --------- Detect if system supports screen capturing API
        var isScreenCapturingSupported = false;
        if (DetectRTC.browser.isChrome && DetectRTC.browser.version >= 35) {
            isScreenCapturingSupported = true;
        } else if (DetectRTC.browser.isFirefox && DetectRTC.browser.version >= 34) {
            isScreenCapturingSupported = true;
        } else if (DetectRTC.browser.isEdge && DetectRTC.browser.version >= 17) {
            isScreenCapturingSupported = true;
        } else if (DetectRTC.osName === 'Android' && DetectRTC.browser.isChrome) {
            isScreenCapturingSupported = true;
        }

        if (!!navigator.getDisplayMedia || (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia)) {
            isScreenCapturingSupported = true;
        }

        if (!/^(https:|chrome-extension:)$/g.test(location.protocol || '')) {
            var isNonLocalHost = typeof document !== 'undefined' && typeof document.domain === 'string' && document.domain.search && document.domain.search(/localhost|127.0./g) === -1;
            if (isNonLocalHost && (DetectRTC.browser.isChrome || DetectRTC.browser.isEdge || DetectRTC.browser.isOpera)) {
                isScreenCapturingSupported = false;
            } else if (DetectRTC.browser.isFirefox) {
                isScreenCapturingSupported = false;
            }
        }
        DetectRTC.isScreenCapturingSupported = isScreenCapturingSupported;

        // --------- Detect if WebAudio API are supported
        var webAudio = {
            isSupported: false,
            isCreateMediaStreamSourceSupported: false
        };

        ['AudioContext', 'webkitAudioContext', 'mozAudioContext', 'msAudioContext'].forEach(function(item) {
            if (webAudio.isSupported) {
                return;
            }

            if (item in window) {
                webAudio.isSupported = true;

                if (window[item] && 'createMediaStreamSource' in window[item].prototype) {
                    webAudio.isCreateMediaStreamSourceSupported = true;
                }
            }
        });
        DetectRTC.isAudioContextSupported = webAudio.isSupported;
        DetectRTC.isCreateMediaStreamSourceSupported = webAudio.isCreateMediaStreamSourceSupported;

        // ---------- Detect if SCTP/RTP channels are supported.

        var isRtpDataChannelsSupported = false;
        if (DetectRTC.browser.isChrome && DetectRTC.browser.version > 31) {
            isRtpDataChannelsSupported = true;
        }
        DetectRTC.isRtpDataChannelsSupported = isRtpDataChannelsSupported;

        var isSCTPSupportd = false;
        if (DetectRTC.browser.isFirefox && DetectRTC.browser.version > 28) {
            isSCTPSupportd = true;
        } else if (DetectRTC.browser.isChrome && DetectRTC.browser.version > 25) {
            isSCTPSupportd = true;
        } else if (DetectRTC.browser.isOpera && DetectRTC.browser.version >= 11) {
            isSCTPSupportd = true;
        }
        DetectRTC.isSctpDataChannelsSupported = isSCTPSupportd;

        // ---------

        DetectRTC.isMobileDevice = isMobileDevice; // "isMobileDevice" boolean is defined in "getBrowserInfo.js"

        // ------
        var isGetUserMediaSupported = false;
        if (navigator.getUserMedia) {
            isGetUserMediaSupported = true;
        } else if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            isGetUserMediaSupported = true;
        }

        if (DetectRTC.browser.isChrome && DetectRTC.browser.version >= 46 && !/^(https:|chrome-extension:)$/g.test(location.protocol || '')) {
            if (typeof document !== 'undefined' && typeof document.domain === 'string' && document.domain.search && document.domain.search(/localhost|127.0./g) === -1) {
                isGetUserMediaSupported = 'Requires HTTPs';
            }
        }

        if (DetectRTC.osName === 'Nodejs') {
            isGetUserMediaSupported = false;
        }
        DetectRTC.isGetUserMediaSupported = isGetUserMediaSupported;

        var displayResolution = '';
        if (screen.width) {
            var width = (screen.width) ? screen.width : '';
            var height = (screen.height) ? screen.height : '';
            displayResolution += '' + width + ' x ' + height;
        }
        DetectRTC.displayResolution = displayResolution;

        function getAspectRatio(w, h) {
            function gcd(a, b) {
                return (b == 0) ? a : gcd(b, a % b);
            }
            var r = gcd(w, h);
            return (w / r) / (h / r);
        }

        DetectRTC.displayAspectRatio = getAspectRatio(screen.width, screen.height).toFixed(2);

        // ----------
        DetectRTC.isCanvasSupportsStreamCapturing = isCanvasSupportsStreamCapturing;
        DetectRTC.isVideoSupportsStreamCapturing = isVideoSupportsStreamCapturing;

        if (DetectRTC.browser.name == 'Chrome' && DetectRTC.browser.version >= 53) {
            if (!DetectRTC.isCanvasSupportsStreamCapturing) {
                DetectRTC.isCanvasSupportsStreamCapturing = 'Requires chrome flag: enable-experimental-web-platform-features';
            }

            if (!DetectRTC.isVideoSupportsStreamCapturing) {
                DetectRTC.isVideoSupportsStreamCapturing = 'Requires chrome flag: enable-experimental-web-platform-features';
            }
        }

        // ------
        DetectRTC.DetectLocalIPAddress = DetectLocalIPAddress;

        DetectRTC.isWebSocketsSupported = 'WebSocket' in window && 2 === window.WebSocket.CLOSING;
        DetectRTC.isWebSocketsBlocked = !DetectRTC.isWebSocketsSupported;

        if (DetectRTC.osName === 'Nodejs') {
            DetectRTC.isWebSocketsSupported = true;
            DetectRTC.isWebSocketsBlocked = false;
        }

        DetectRTC.checkWebSocketsSupport = function(callback) {
            callback = callback || function() {};
            try {
                var starttime;
                var websocket = new WebSocket('wss://echo.websocket.org:443/');
                websocket.onopen = function() {
                    DetectRTC.isWebSocketsBlocked = false;
                    starttime = (new Date).getTime();
                    websocket.send('ping');
                };
                websocket.onmessage = function() {
                    DetectRTC.WebsocketLatency = (new Date).getTime() - starttime + 'ms';
                    callback();
                    websocket.close();
                    websocket = null;
                };
                websocket.onerror = function() {
                    DetectRTC.isWebSocketsBlocked = true;
                    callback();
                };
            } catch (e) {
                DetectRTC.isWebSocketsBlocked = true;
                callback();
            }
        };

        // -------
        DetectRTC.load = function(callback) {
            callback = callback || function() {};
            checkDeviceSupport(callback);
        };

        // check for microphone/camera support!
        if (typeof checkDeviceSupport === 'function') {
            // checkDeviceSupport();
        }

        if (typeof MediaDevices !== 'undefined') {
            DetectRTC.MediaDevices = MediaDevices;
        } else {
            DetectRTC.MediaDevices = [];
        }

        DetectRTC.hasMicrophone = hasMicrophone;
        DetectRTC.hasSpeakers = hasSpeakers;
        DetectRTC.hasWebcam = hasWebcam;

        DetectRTC.isWebsiteHasWebcamPermissions = isWebsiteHasWebcamPermissions;
        DetectRTC.isWebsiteHasMicrophonePermissions = isWebsiteHasMicrophonePermissions;

        DetectRTC.audioInputDevices = audioInputDevices;
        DetectRTC.audioOutputDevices = audioOutputDevices;
        DetectRTC.videoInputDevices = videoInputDevices;

        // ------
        var isSetSinkIdSupported = false;
        if (typeof document !== 'undefined' && typeof document.createElement === 'function' && 'setSinkId' in document.createElement('video')) {
            isSetSinkIdSupported = true;
        }
        DetectRTC.isSetSinkIdSupported = isSetSinkIdSupported;

        // -----
        var isRTPSenderReplaceTracksSupported = false;
        if (DetectRTC.browser.isFirefox && typeof mozRTCPeerConnection !== 'undefined' /*&& DetectRTC.browser.version > 39*/ ) {
            /*global mozRTCPeerConnection:true */
            if ('getSenders' in mozRTCPeerConnection.prototype) {
                isRTPSenderReplaceTracksSupported = true;
            }
        } else if (DetectRTC.browser.isChrome && typeof webkitRTCPeerConnection !== 'undefined') {
            /*global webkitRTCPeerConnection:true */
            if ('getSenders' in webkitRTCPeerConnection.prototype) {
                isRTPSenderReplaceTracksSupported = true;
            }
        }
        DetectRTC.isRTPSenderReplaceTracksSupported = isRTPSenderReplaceTracksSupported;

        //------
        var isRemoteStreamProcessingSupported = false;
        if (DetectRTC.browser.isFirefox && DetectRTC.browser.version > 38) {
            isRemoteStreamProcessingSupported = true;
        }
        DetectRTC.isRemoteStreamProcessingSupported = isRemoteStreamProcessingSupported;

        //-------
        var isApplyConstraintsSupported = false;

        /*global MediaStreamTrack:true */
        if (typeof MediaStreamTrack !== 'undefined' && 'applyConstraints' in MediaStreamTrack.prototype) {
            isApplyConstraintsSupported = true;
        }
        DetectRTC.isApplyConstraintsSupported = isApplyConstraintsSupported;

        //-------
        var isMultiMonitorScreenCapturingSupported = false;
        if (DetectRTC.browser.isFirefox && DetectRTC.browser.version >= 43) {
            // version 43 merely supports platforms for multi-monitors
            // version 44 will support exact multi-monitor selection i.e. you can select any monitor for screen capturing.
            isMultiMonitorScreenCapturingSupported = true;
        }
        DetectRTC.isMultiMonitorScreenCapturingSupported = isMultiMonitorScreenCapturingSupported;

        DetectRTC.isPromisesSupported = !!('Promise' in window);

        // version is generated by "grunt"
        DetectRTC.version = '1.4.0';

        if (typeof DetectRTC === 'undefined') {
            window.DetectRTC = {};
        }

        var MediaStream = window.MediaStream;

        if (typeof MediaStream === 'undefined' && typeof webkitMediaStream !== 'undefined') {
            MediaStream = webkitMediaStream;
        }

        if (typeof MediaStream !== 'undefined' && typeof MediaStream === 'function') {
            DetectRTC.MediaStream = Object.keys(MediaStream.prototype);
        } else DetectRTC.MediaStream = false;

        if (typeof MediaStreamTrack !== 'undefined') {
            DetectRTC.MediaStreamTrack = Object.keys(MediaStreamTrack.prototype);
        } else DetectRTC.MediaStreamTrack = false;

        var RTCPeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection;

        if (typeof RTCPeerConnection !== 'undefined') {
            DetectRTC.RTCPeerConnection = Object.keys(RTCPeerConnection.prototype);
        } else DetectRTC.RTCPeerConnection = false;

        window.DetectRTC = DetectRTC;

        if (typeof module !== 'undefined' /* && !!module.exports*/ ) {
            module.exports = DetectRTC;
        }

        if (typeof define === 'function' && define.amd) {
            define('DetectRTC', [], function() {
                return DetectRTC;
            });
        }
    })();

    // globals.js

    if (typeof cordova !== 'undefined') {
        DetectRTC.isMobileDevice = true;
        DetectRTC.browser.name = 'Chrome';
    }

    if (navigator && navigator.userAgent && navigator.userAgent.indexOf('Crosswalk') !== -1) {
        DetectRTC.isMobileDevice = true;
        DetectRTC.browser.name = 'Chrome';
    }

    function fireEvent(obj, eventName, args) {
        if (typeof CustomEvent === 'undefined') {
            return;
        }

        var eventDetail = {
            arguments: args,
            __exposedProps__: args
        };

        var event = new CustomEvent(eventName, eventDetail);
        obj.dispatchEvent(event);
    }

    function setHarkEvents(connection, streamEvent) {
        if (!streamEvent.stream || !getTracks(streamEvent.stream, 'audio').length) return;

        if (!connection || !streamEvent) {
            throw 'Both arguments are required.';
        }

        if (!connection.onspeaking || !connection.onsilence) {
            return;
        }

        if (typeof hark === 'undefined') {
            throw 'hark.js not found.';
        }

        hark(streamEvent.stream, {
            onspeaking: function() {
                connection.onspeaking(streamEvent);
            },
            onsilence: function() {
                connection.onsilence(streamEvent);
            },
            onvolumechange: function(volume, threshold) {
                if (!connection.onvolumechange) {
                    return;
                }
                connection.onvolumechange(merge({
                    volume: volume,
                    threshold: threshold
                }, streamEvent));
            }
        });
    }

    function setMuteHandlers(connection, streamEvent) {
        if (!streamEvent.stream || !streamEvent.stream || !streamEvent.stream.addEventListener) return;

        streamEvent.stream.addEventListener('mute', function(event) {
            event = connection.streamEvents[streamEvent.streamid];

            event.session = {
                audio: event.muteType === 'audio',
                video: event.muteType === 'video'
            };

            connection.onmute(event);
        }, false);

        streamEvent.stream.addEventListener('unmute', function(event) {
            event = connection.streamEvents[streamEvent.streamid];

            event.session = {
                audio: event.unmuteType === 'audio',
                video: event.unmuteType === 'video'
            };

            connection.onunmute(event);
        }, false);
    }

    function getRandomString() {
        if (window.crypto && window.crypto.getRandomValues && navigator.userAgent.indexOf('Safari') === -1) {
            var a = window.crypto.getRandomValues(new Uint32Array(3)),
                token = '';
            for (var i = 0, l = a.length; i < l; i++) {
                token += a[i].toString(36);
            }
            return token;
        } else {
            return (Math.random() * new Date().getTime()).toString(36).replace(/\./g, '');
        }
    }

    // Get HTMLAudioElement/HTMLVideoElement accordingly
    // todo: add API documentation for connection.autoCreateMediaElement

    function getRMCMediaElement(stream, callback, connection) {
        if (!connection.autoCreateMediaElement) {
            callback({});
            return;
        }

        var isAudioOnly = false;
        if (!getTracks(stream, 'video').length && !stream.isVideo && !stream.isScreen) {
            isAudioOnly = true;
        }

        if (DetectRTC.browser.name === 'Firefox') {
            if (connection.session.video || connection.session.screen) {
                isAudioOnly = false;
            }
        }

        var mediaElement = document.createElement(isAudioOnly ? 'audio' : 'video');

        mediaElement.srcObject = stream;

        mediaElement.setAttribute('autoplay', true);
        mediaElement.setAttribute('playsinline', true);
        mediaElement.setAttribute('controls', true);
        mediaElement.setAttribute('muted', false);
        mediaElement.setAttribute('volume', 1);

        // http://goo.gl/WZ5nFl
        // Firefox don't yet support onended for any stream (remote/local)
        if (DetectRTC.browser.name === 'Firefox') {
            var streamEndedEvent = 'ended';

            if ('oninactive' in mediaElement) {
                streamEndedEvent = 'inactive';
            }

            mediaElement.addEventListener(streamEndedEvent, function() {
                // fireEvent(stream, streamEndedEvent, stream);
                currentUserMediaRequest.remove(stream.idInstance);

                if (stream.type === 'local') {
                    streamEndedEvent = 'ended';

                    if ('oninactive' in stream) {
                        streamEndedEvent = 'inactive';
                    }

                    StreamsHandler.onSyncNeeded(stream.streamid, streamEndedEvent);

                    connection.attachStreams.forEach(function(aStream, idx) {
                        if (stream.streamid === aStream.streamid) {
                            delete connection.attachStreams[idx];
                        }
                    });

                    var newStreamsArray = [];
                    connection.attachStreams.forEach(function(aStream) {
                        if (aStream) {
                            newStreamsArray.push(aStream);
                        }
                    });
                    connection.attachStreams = newStreamsArray;

                    var streamEvent = connection.streamEvents[stream.streamid];

                    if (streamEvent) {
                        connection.onstreamended(streamEvent);
                        return;
                    }
                    if (this.parentNode) {
                        this.parentNode.removeChild(this);
                    }
                }
            }, false);
        }

        var played = mediaElement.play();
        if (typeof played !== 'undefined') {
            var cbFired = false;
            setTimeout(function() {
                if (!cbFired) {
                    cbFired = true;
                    callback(mediaElement);
                }
            }, 1000);
            played.then(function() {
                if (cbFired) return;
                cbFired = true;
                callback(mediaElement);
            }).catch(function(error) {
                if (cbFired) return;
                cbFired = true;
                callback(mediaElement);
            });
        } else {
            callback(mediaElement);
        }
    }

    // if IE
    if (!window.addEventListener) {
        window.addEventListener = function(el, eventName, eventHandler) {
            if (!el.attachEvent) {
                return;
            }
            el.attachEvent('on' + eventName, eventHandler);
        };
    }

    function listenEventHandler(eventName, eventHandler) {
        window.removeEventListener(eventName, eventHandler);
        window.addEventListener(eventName, eventHandler, false);
    }

    window.attachEventListener = function(video, type, listener, useCapture) {
        video.addEventListener(type, listener, useCapture);
    };

    function removeNullEntries(array) {
        var newArray = [];
        array.forEach(function(item) {
            if (item) {
                newArray.push(item);
            }
        });
        return newArray;
    }


    function isData(session) {
        return !session.audio && !session.video && !session.screen && session.data;
    }

    function isNull(obj) {
        return typeof obj === 'undefined';
    }

    function isString(obj) {
        return typeof obj === 'string';
    }

    var MediaStream = window.MediaStream;

    if (typeof MediaStream === 'undefined' && typeof webkitMediaStream !== 'undefined') {
        MediaStream = webkitMediaStream;
    }

    /*global MediaStream:true */
    if (typeof MediaStream !== 'undefined') {
        if (!('stop' in MediaStream.prototype)) {
            MediaStream.prototype.stop = function() {
                this.getTracks().forEach(function(track) {
                    track.stop();
                });
            };
        }
    }

    function isAudioPlusTab(connection, audioPlusTab) {
        if (connection.session.audio && connection.session.audio === 'two-way') {
            return false;
        }

        if (DetectRTC.browser.name === 'Firefox' && audioPlusTab !== false) {
            return true;
        }

        if (DetectRTC.browser.name !== 'Chrome' || DetectRTC.browser.version < 50) return false;

        if (typeof audioPlusTab === true) {
            return true;
        }

        if (typeof audioPlusTab === 'undefined' && connection.session.audio && connection.session.screen && !connection.session.video) {
            audioPlusTab = true;
            return true;
        }

        return false;
    }

    function getAudioScreenConstraints(screen_constraints) {
        if (DetectRTC.browser.name === 'Firefox') {
            return true;
        }

        if (DetectRTC.browser.name !== 'Chrome') return false;

        return {
            mandatory: {
                chromeMediaSource: screen_constraints.mandatory.chromeMediaSource,
                chromeMediaSourceId: screen_constraints.mandatory.chromeMediaSourceId
            }
        };
    }

    window.iOSDefaultAudioOutputDevice = window.iOSDefaultAudioOutputDevice || 'speaker'; // earpiece or speaker

    function getTracks(stream, kind) {
        if (!stream || !stream.getTracks) {
            return [];
        }

        return stream.getTracks().filter(function(t) {
            return t.kind === (kind || 'audio');
        });
    }

    function isUnifiedPlanSupportedDefault() {
        var canAddTransceiver = false;

        try {
            if (typeof RTCRtpTransceiver === 'undefined') return false;
            if (!('currentDirection' in RTCRtpTransceiver.prototype)) return false;

            var tempPc = new RTCPeerConnection();

            try {
                tempPc.addTransceiver('audio');
                canAddTransceiver = true;
            } catch (e) {}

            tempPc.close();
        } catch (e) {
            canAddTransceiver = false;
        }

        return canAddTransceiver && isUnifiedPlanSuppored();
    }

    function isUnifiedPlanSuppored() {
        var isUnifiedPlanSupported = false;

        try {
            var pc = new RTCPeerConnection({
                sdpSemantics: 'unified-plan'
            });

            try {
                var config = pc.getConfiguration();
                if (config.sdpSemantics == 'unified-plan')
                    isUnifiedPlanSupported = true;
                else if (config.sdpSemantics == 'plan-b')
                    isUnifiedPlanSupported = false;
                else
                    isUnifiedPlanSupported = false;
            } catch (e) {
                isUnifiedPlanSupported = false;
            }
        } catch (e) {
            isUnifiedPlanSupported = false;
        }

        return isUnifiedPlanSupported;
    }

    // ios-hacks.js

    function setCordovaAPIs() {
        // if (DetectRTC.osName !== 'iOS') return;
        if (typeof cordova === 'undefined' || typeof cordova.plugins === 'undefined' || typeof cordova.plugins.iosrtc === 'undefined') return;

        var iosrtc = cordova.plugins.iosrtc;
        window.webkitRTCPeerConnection = iosrtc.RTCPeerConnection;
        window.RTCSessionDescription = iosrtc.RTCSessionDescription;
        window.RTCIceCandidate = iosrtc.RTCIceCandidate;
        window.MediaStream = iosrtc.MediaStream;
        window.MediaStreamTrack = iosrtc.MediaStreamTrack;
        navigator.getUserMedia = navigator.webkitGetUserMedia = iosrtc.getUserMedia;

        iosrtc.debug.enable('iosrtc*');
        if (typeof iosrtc.selectAudioOutput == 'function') {
            iosrtc.selectAudioOutput(window.iOSDefaultAudioOutputDevice || 'speaker'); // earpiece or speaker
        }
        iosrtc.registerGlobals();
    }

    document.addEventListener('deviceready', setCordovaAPIs, false);
    setCordovaAPIs();

    // RTCPeerConnection.js

    var defaults = {};

    function setSdpConstraints(config) {
        var sdpConstraints = {
            OfferToReceiveAudio: !!config.OfferToReceiveAudio,
            OfferToReceiveVideo: !!config.OfferToReceiveVideo
        };

        return sdpConstraints;
    }

    var RTCPeerConnection;
    if (typeof window.RTCPeerConnection !== 'undefined') {
        RTCPeerConnection = window.RTCPeerConnection;
    } else if (typeof mozRTCPeerConnection !== 'undefined') {
        RTCPeerConnection = mozRTCPeerConnection;
    } else if (typeof webkitRTCPeerConnection !== 'undefined') {
        RTCPeerConnection = webkitRTCPeerConnection;
    }

    var RTCSessionDescription = window.RTCSessionDescription || window.mozRTCSessionDescription;
    var RTCIceCandidate = window.RTCIceCandidate || window.mozRTCIceCandidate;
    var MediaStreamTrack = window.MediaStreamTrack;

    function PeerInitiator(config) {
        if (typeof window.RTCPeerConnection !== 'undefined') {
            RTCPeerConnection = window.RTCPeerConnection;
        } else if (typeof mozRTCPeerConnection !== 'undefined') {
            RTCPeerConnection = mozRTCPeerConnection;
        } else if (typeof webkitRTCPeerConnection !== 'undefined') {
            RTCPeerConnection = webkitRTCPeerConnection;
        }

        RTCSessionDescription = window.RTCSessionDescription || window.mozRTCSessionDescription;
        RTCIceCandidate = window.RTCIceCandidate || window.mozRTCIceCandidate;
        MediaStreamTrack = window.MediaStreamTrack;

        if (!RTCPeerConnection) {
            throw 'WebRTC 1.0 (RTCPeerConnection) API are NOT available in this browser.';
        }

        var connection = config.rtcMultiConnection;

        this.extra = config.remoteSdp ? config.remoteSdp.extra : connection.extra;
        this.userid = config.userid;
        this.streams = [];
        this.channels = config.channels || [];
        this.connectionDescription = config.connectionDescription;

        this.addStream = function(session) {
            connection.addStream(session, self.userid);
        };

        this.removeStream = function(streamid) {
            connection.removeStream(streamid, self.userid);
        };

        var self = this;

        if (config.remoteSdp) {
            this.connectionDescription = config.remoteSdp.connectionDescription;
        }

        var allRemoteStreams = {};

        defaults.sdpConstraints = setSdpConstraints({
            OfferToReceiveAudio: true,
            OfferToReceiveVideo: true
        });

        var peer;

        var renegotiatingPeer = !!config.renegotiatingPeer;
        if (config.remoteSdp) {
            renegotiatingPeer = !!config.remoteSdp.renegotiatingPeer;
        }

        var localStreams = [];
        connection.attachStreams.forEach(function(stream) {
            if (!!stream) {
                localStreams.push(stream);
            }
        });

        if (!renegotiatingPeer) {
            var iceTransports = 'all';
            if (connection.candidates.turn || connection.candidates.relay) {
                if (!connection.candidates.stun && !connection.candidates.reflexive && !connection.candidates.host) {
                    iceTransports = 'relay';
                }
            }

            try {
                // ref: developer.mozilla.org/en-US/docs/Web/API/RTCConfiguration
                var params = {
                    iceServers: connection.iceServers,
                    iceTransportPolicy: connection.iceTransportPolicy || iceTransports
                };

                if (typeof connection.iceCandidatePoolSize !== 'undefined') {
                    params.iceCandidatePoolSize = connection.iceCandidatePoolSize;
                }

                if (typeof connection.bundlePolicy !== 'undefined') {
                    params.bundlePolicy = connection.bundlePolicy;
                }

                if (typeof connection.rtcpMuxPolicy !== 'undefined') {
                    params.rtcpMuxPolicy = connection.rtcpMuxPolicy;
                }

                if (!!connection.sdpSemantics) {
                    params.sdpSemantics = connection.sdpSemantics || 'unified-plan';
                }

                if (!connection.iceServers || !connection.iceServers.length) {
                    params = null;
                    connection.optionalArgument = null;
                }

                peer = new RTCPeerConnection(params, connection.optionalArgument);
            } catch (e) {
                try {
                    var params = {
                        iceServers: connection.iceServers
                    };

                    peer = new RTCPeerConnection(params);
                } catch (e) {
                    peer = new RTCPeerConnection();
                }
            }
        } else {
            peer = config.peerRef;
        }

        if (!peer.getRemoteStreams && peer.getReceivers) {
            peer.getRemoteStreams = function() {
                var stream = new MediaStream();
                peer.getReceivers().forEach(function(receiver) {
                    stream.addTrack(receiver.track);
                });
                return [stream];
            };
        }

        if (!peer.getLocalStreams && peer.getSenders) {
            peer.getLocalStreams = function() {
                var stream = new MediaStream();
                peer.getSenders().forEach(function(sender) {
                    stream.addTrack(sender.track);
                });
                return [stream];
            };
        }

        peer.onicecandidate = function(event) {
            if (!event.candidate) {
                if (!connection.trickleIce) {
                    var localSdp = peer.localDescription;
                    config.onLocalSdp({
                        type: localSdp.type,
                        sdp: localSdp.sdp,
                        remotePeerSdpConstraints: config.remotePeerSdpConstraints || false,
                        renegotiatingPeer: !!config.renegotiatingPeer || false,
                        connectionDescription: self.connectionDescription,
                        dontGetRemoteStream: !!config.dontGetRemoteStream,
                        extra: connection ? connection.extra : {},
                        streamsToShare: streamsToShare
                    });
                }
                return;
            }

            if (!connection.trickleIce) return;
            config.onLocalCandidate({
                candidate: event.candidate.candidate,
                sdpMid: event.candidate.sdpMid,
                sdpMLineIndex: event.candidate.sdpMLineIndex
            });
        };

        localStreams.forEach(function(localStream) {
            if (config.remoteSdp && config.remoteSdp.remotePeerSdpConstraints && config.remoteSdp.remotePeerSdpConstraints.dontGetRemoteStream) {
                return;
            }

            if (config.dontAttachLocalStream) {
                return;
            }

            localStream = connection.beforeAddingStream(localStream, self);

            if (!localStream) return;

            peer.getLocalStreams().forEach(function(stream) {
                if (localStream && stream.id == localStream.id) {
                    localStream = null;
                }
            });

            if (localStream && localStream.getTracks) {
                localStream.getTracks().forEach(function(track) {
                    try {
                        // last parameter is redundant for unified-plan
                        // starting from chrome version 72
                        peer.addTrack(track, localStream);
                    } catch (e) {}
                });
            }
        });

        peer.oniceconnectionstatechange = peer.onsignalingstatechange = function() {
            var extra = self.extra;
            if (connection.peers[self.userid]) {
                extra = connection.peers[self.userid].extra || extra;
            }

            if (!peer) {
                return;
            }

            config.onPeerStateChanged({
                iceConnectionState: peer.iceConnectionState,
                iceGatheringState: peer.iceGatheringState,
                signalingState: peer.signalingState,
                extra: extra,
                userid: self.userid
            });

            if (peer && peer.iceConnectionState && peer.iceConnectionState.search(/closed|failed/gi) !== -1 && self.streams instanceof Array) {
                self.streams.forEach(function(stream) {
                    var streamEvent = connection.streamEvents[stream.id] || {
                        streamid: stream.id,
                        stream: stream,
                        type: 'remote'
                    };

                    connection.onstreamended(streamEvent);
                });
            }
        };

        var sdpConstraints = {
            OfferToReceiveAudio: !!localStreams.length,
            OfferToReceiveVideo: !!localStreams.length
        };

        if (config.localPeerSdpConstraints) sdpConstraints = config.localPeerSdpConstraints;

        defaults.sdpConstraints = setSdpConstraints(sdpConstraints);

        var streamObject;
        var dontDuplicate = {};

        peer.ontrack = function(event) {
            if (!event || event.type !== 'track') return;

            event.stream = event.streams[event.streams.length - 1];

            if (!event.stream.id) {
                event.stream.id = event.track.id;
            }

            if (dontDuplicate[event.stream.id] && DetectRTC.browser.name !== 'Safari') {
                if (event.track) {
                    event.track.onended = function() { // event.track.onmute = 
                        peer && peer.onremovestream(event);
                    };
                }
                return;
            }

            dontDuplicate[event.stream.id] = event.stream.id;

            var streamsToShare = {};
            if (config.remoteSdp && config.remoteSdp.streamsToShare) {
                streamsToShare = config.remoteSdp.streamsToShare;
            } else if (config.streamsToShare) {
                streamsToShare = config.streamsToShare;
            }

            var streamToShare = streamsToShare[event.stream.id];
            if (streamToShare) {
                event.stream.isAudio = streamToShare.isAudio;
                event.stream.isVideo = streamToShare.isVideo;
                event.stream.isScreen = streamToShare.isScreen;
            } else {
                event.stream.isVideo = !!getTracks(event.stream, 'video').length;
                event.stream.isAudio = !event.stream.isVideo;
                event.stream.isScreen = false;
            }

            event.stream.streamid = event.stream.id;

            allRemoteStreams[event.stream.id] = event.stream;
            config.onRemoteStream(event.stream);

            event.stream.getTracks().forEach(function(track) {
                track.onended = function() { // track.onmute = 
                    peer && peer.onremovestream(event);
                };
            });

            event.stream.onremovetrack = function() {
                peer && peer.onremovestream(event);
            };
        };

        peer.onremovestream = function(event) {
            // this event doesn't works anymore
            event.stream.streamid = event.stream.id;

            if (allRemoteStreams[event.stream.id]) {
                delete allRemoteStreams[event.stream.id];
            }

            config.onRemoteStreamRemoved(event.stream);
        };

        if (typeof peer.removeStream !== 'function') {
            // removeStream backward compatibility
            peer.removeStream = function(stream) {
                stream.getTracks().forEach(function(track) {
                    peer.removeTrack(track, stream);
                });
            };
        }

        this.addRemoteCandidate = function(remoteCandidate) {
            peer.addIceCandidate(new RTCIceCandidate(remoteCandidate));
        };

        function oldAddRemoteSdp(remoteSdp, cb) {
            cb = cb || function() {};

            if (DetectRTC.browser.name !== 'Safari') {
                remoteSdp.sdp = connection.processSdp(remoteSdp.sdp);
            }
            peer.setRemoteDescription(new RTCSessionDescription(remoteSdp), cb, function(error) {
                if (!!connection.enableLogs) {
                    console.error('setRemoteDescription failed', '\n', error, '\n', remoteSdp.sdp);
                }

                cb();
            });
        }

        this.addRemoteSdp = function(remoteSdp, cb) {
            cb = cb || function() {};

            if (DetectRTC.browser.name !== 'Safari') {
                remoteSdp.sdp = connection.processSdp(remoteSdp.sdp);
            }

            peer.setRemoteDescription(new RTCSessionDescription(remoteSdp)).then(cb, function(error) {
                if (!!connection.enableLogs) {
                    console.error('setRemoteDescription failed', '\n', error, '\n', remoteSdp.sdp);
                }

                cb();
            }).catch(function(error) {
                if (!!connection.enableLogs) {
                    console.error('setRemoteDescription failed', '\n', error, '\n', remoteSdp.sdp);
                }

                cb();
            });
        };

        var isOfferer = true;

        if (config.remoteSdp) {
            isOfferer = false;
        }

        this.createDataChannel = function() {
            var channel = peer.createDataChannel('sctp', {});
            setChannelEvents(channel);
        };

        if (connection.session.data === true && !renegotiatingPeer) {
            if (!isOfferer) {
                peer.ondatachannel = function(event) {
                    var channel = event.channel;
                    setChannelEvents(channel);
                };
            } else {
                this.createDataChannel();
            }
        }

        this.enableDisableVideoEncoding = function(enable) {
            var rtcp;
            peer.getSenders().forEach(function(sender) {
                if (!rtcp && sender.track.kind === 'video') {
                    rtcp = sender;
                }
            });

            if (!rtcp || !rtcp.getParameters) return;

            var parameters = rtcp.getParameters();
            parameters.encodings[1] && (parameters.encodings[1].active = !!enable);
            parameters.encodings[2] && (parameters.encodings[2].active = !!enable);
            rtcp.setParameters(parameters);
        };

        if (config.remoteSdp) {
            if (config.remoteSdp.remotePeerSdpConstraints) {
                sdpConstraints = config.remoteSdp.remotePeerSdpConstraints;
            }
            defaults.sdpConstraints = setSdpConstraints(sdpConstraints);
            this.addRemoteSdp(config.remoteSdp, function() {
                createOfferOrAnswer('createAnswer');
            });
        }

        function setChannelEvents(channel) {
            // force ArrayBuffer in Firefox; which uses "Blob" by default.
            channel.binaryType = 'arraybuffer';

            channel.onmessage = function(event) {
                config.onDataChannelMessage(event.data);
            };

            channel.onopen = function() {
                config.onDataChannelOpened(channel);
            };

            channel.onerror = function(error) {
                config.onDataChannelError(error);
            };

            channel.onclose = function(event) {
                config.onDataChannelClosed(event);
            };

            channel.internalSend = channel.send;
            channel.send = function(data) {
                if (channel.readyState !== 'open') {
                    return;
                }

                channel.internalSend(data);
            };

            peer.channel = channel;
        }

        if (connection.session.audio == 'two-way' || connection.session.video == 'two-way' || connection.session.screen == 'two-way') {
            defaults.sdpConstraints = setSdpConstraints({
                OfferToReceiveAudio: connection.session.audio == 'two-way' || (config.remoteSdp && config.remoteSdp.remotePeerSdpConstraints && config.remoteSdp.remotePeerSdpConstraints.OfferToReceiveAudio),
                OfferToReceiveVideo: connection.session.video == 'two-way' || connection.session.screen == 'two-way' || (config.remoteSdp && config.remoteSdp.remotePeerSdpConstraints && config.remoteSdp.remotePeerSdpConstraints.OfferToReceiveAudio)
            });
        }

        var streamsToShare = {};
        peer.getLocalStreams().forEach(function(stream) {
            streamsToShare[stream.streamid] = {
                isAudio: !!stream.isAudio,
                isVideo: !!stream.isVideo,
                isScreen: !!stream.isScreen
            };
        });

        function oldCreateOfferOrAnswer(_method) {
            peer[_method](function(localSdp) {
                if (DetectRTC.browser.name !== 'Safari') {
                    localSdp.sdp = connection.processSdp(localSdp.sdp);
                }
                peer.setLocalDescription(localSdp, function() {
                    if (!connection.trickleIce) return;

                    config.onLocalSdp({
                        type: localSdp.type,
                        sdp: localSdp.sdp,
                        remotePeerSdpConstraints: config.remotePeerSdpConstraints || false,
                        renegotiatingPeer: !!config.renegotiatingPeer || false,
                        connectionDescription: self.connectionDescription,
                        dontGetRemoteStream: !!config.dontGetRemoteStream,
                        extra: connection ? connection.extra : {},
                        streamsToShare: streamsToShare
                    });

                    connection.onSettingLocalDescription(self);
                }, function(error) {
                    if (!!connection.enableLogs) {
                        console.error('setLocalDescription-error', error);
                    }
                });
            }, function(error) {
                if (!!connection.enableLogs) {
                    console.error('sdp-' + _method + '-error', error);
                }
            }, defaults.sdpConstraints);
        }

        function createOfferOrAnswer(_method) {
            peer[_method](defaults.sdpConstraints).then(function(localSdp) {
                if (DetectRTC.browser.name !== 'Safari') {
                    localSdp.sdp = connection.processSdp(localSdp.sdp);
                }
                peer.setLocalDescription(localSdp).then(function() {
                    if (!connection.trickleIce) return;

                    config.onLocalSdp({
                        type: localSdp.type,
                        sdp: localSdp.sdp,
                        remotePeerSdpConstraints: config.remotePeerSdpConstraints || false,
                        renegotiatingPeer: !!config.renegotiatingPeer || false,
                        connectionDescription: self.connectionDescription,
                        dontGetRemoteStream: !!config.dontGetRemoteStream,
                        extra: connection ? connection.extra : {},
                        streamsToShare: streamsToShare
                    });

                    connection.onSettingLocalDescription(self);
                }, function(error) {
                    if (!connection.enableLogs) return;
                    console.error('setLocalDescription error', error);
                });
            }, function(error) {
                if (!!connection.enableLogs) {
                    console.error('sdp-error', error);
                }
            });
        }

        if (isOfferer) {
            createOfferOrAnswer('createOffer');
        }

        peer.nativeClose = peer.close;
        peer.close = function() {
            if (!peer) {
                return;
            }

            try {
                if (peer.nativeClose !== peer.close) {
                    peer.nativeClose();
                }
            } catch (e) {}

            peer = null;
            self.peer = null;
        };

        this.peer = peer;
    }

    // CodecsHandler.js

    var CodecsHandler = (function() {
        // use "RTCRtpTransceiver.setCodecPreferences"
        function preferCodec(sdp, codecName) {
            var info = splitLines(sdp);

            if (!info.videoCodecNumbers) {
                return sdp;
            }

            if (codecName === 'vp8' && info.vp8LineNumber === info.videoCodecNumbers[0]) {
                return sdp;
            }

            if (codecName === 'vp9' && info.vp9LineNumber === info.videoCodecNumbers[0]) {
                return sdp;
            }

            if (codecName === 'h264' && info.h264LineNumber === info.videoCodecNumbers[0]) {
                return sdp;
            }

            sdp = preferCodecHelper(sdp, codecName, info);

            return sdp;
        }

        function preferCodecHelper(sdp, codec, info, ignore) {
            var preferCodecNumber = '';

            if (codec === 'vp8') {
                if (!info.vp8LineNumber) {
                    return sdp;
                }
                preferCodecNumber = info.vp8LineNumber;
            }

            if (codec === 'vp9') {
                if (!info.vp9LineNumber) {
                    return sdp;
                }
                preferCodecNumber = info.vp9LineNumber;
            }

            if (codec === 'h264') {
                if (!info.h264LineNumber) {
                    return sdp;
                }

                preferCodecNumber = info.h264LineNumber;
            }

            var newLine = info.videoCodecNumbersOriginal.split('SAVPF')[0] + 'SAVPF ';

            var newOrder = [preferCodecNumber];

            if (ignore) {
                newOrder = [];
            }

            info.videoCodecNumbers.forEach(function(codecNumber) {
                if (codecNumber === preferCodecNumber) return;
                newOrder.push(codecNumber);
            });

            newLine += newOrder.join(' ');

            sdp = sdp.replace(info.videoCodecNumbersOriginal, newLine);
            return sdp;
        }

        function splitLines(sdp) {
            var info = {};
            sdp.split('\n').forEach(function(line) {
                if (line.indexOf('m=video') === 0) {
                    info.videoCodecNumbers = [];
                    line.split('SAVPF')[1].split(' ').forEach(function(codecNumber) {
                        codecNumber = codecNumber.trim();
                        if (!codecNumber || !codecNumber.length) return;
                        info.videoCodecNumbers.push(codecNumber);
                        info.videoCodecNumbersOriginal = line;
                    });
                }

                if (line.indexOf('VP8/90000') !== -1 && !info.vp8LineNumber) {
                    info.vp8LineNumber = line.replace('a=rtpmap:', '').split(' ')[0];
                }

                if (line.indexOf('VP9/90000') !== -1 && !info.vp9LineNumber) {
                    info.vp9LineNumber = line.replace('a=rtpmap:', '').split(' ')[0];
                }

                if (line.indexOf('H264/90000') !== -1 && !info.h264LineNumber) {
                    info.h264LineNumber = line.replace('a=rtpmap:', '').split(' ')[0];
                }
            });

            return info;
        }

        function removeVPX(sdp) {
            var info = splitLines(sdp);

            // last parameter below means: ignore these codecs
            sdp = preferCodecHelper(sdp, 'vp9', info, true);
            sdp = preferCodecHelper(sdp, 'vp8', info, true);

            return sdp;
        }

        function disableNACK(sdp) {
            if (!sdp || typeof sdp !== 'string') {
                throw 'Invalid arguments.';
            }

            sdp = sdp.replace('a=rtcp-fb:126 nack\r\n', '');
            sdp = sdp.replace('a=rtcp-fb:126 nack pli\r\n', 'a=rtcp-fb:126 pli\r\n');
            sdp = sdp.replace('a=rtcp-fb:97 nack\r\n', '');
            sdp = sdp.replace('a=rtcp-fb:97 nack pli\r\n', 'a=rtcp-fb:97 pli\r\n');

            return sdp;
        }

        function prioritize(codecMimeType, peer) {
            if (!peer || !peer.getSenders || !peer.getSenders().length) {
                return;
            }

            if (!codecMimeType || typeof codecMimeType !== 'string') {
                throw 'Invalid arguments.';
            }

            peer.getSenders().forEach(function(sender) {
                var params = sender.getParameters();
                for (var i = 0; i < params.codecs.length; i++) {
                    if (params.codecs[i].mimeType == codecMimeType) {
                        params.codecs.unshift(params.codecs.splice(i, 1));
                        break;
                    }
                }
                sender.setParameters(params);
            });
        }

        function removeNonG722(sdp) {
            return sdp.replace(/m=audio ([0-9]+) RTP\/SAVPF ([0-9 ]*)/g, 'm=audio $1 RTP\/SAVPF 9');
        }

        function setBAS(sdp, bandwidth, isScreen) {
            if (!bandwidth) {
                return sdp;
            }

            if (typeof isFirefox !== 'undefined' && isFirefox) {
                return sdp;
            }

            if (isScreen) {
                if (!bandwidth.screen) {
                    console.warn('It seems that you are not using bandwidth for screen. Screen sharing is expected to fail.');
                } else if (bandwidth.screen < 300) {
                    console.warn('It seems that you are using wrong bandwidth value for screen. Screen sharing is expected to fail.');
                }
            }

            // if screen; must use at least 300kbs
            if (bandwidth.screen && isScreen) {
                sdp = sdp.replace(/b=AS([^\r\n]+\r\n)/g, '');
                sdp = sdp.replace(/a=mid:video\r\n/g, 'a=mid:video\r\nb=AS:' + bandwidth.screen + '\r\n');
            }

            // remove existing bandwidth lines
            if (bandwidth.audio || bandwidth.video) {
                sdp = sdp.replace(/b=AS([^\r\n]+\r\n)/g, '');
            }

            if (bandwidth.audio) {
                sdp = sdp.replace(/a=mid:audio\r\n/g, 'a=mid:audio\r\nb=AS:' + bandwidth.audio + '\r\n');
            }

            if (bandwidth.screen) {
                sdp = sdp.replace(/a=mid:video\r\n/g, 'a=mid:video\r\nb=AS:' + bandwidth.screen + '\r\n');
            } else if (bandwidth.video) {
                sdp = sdp.replace(/a=mid:video\r\n/g, 'a=mid:video\r\nb=AS:' + bandwidth.video + '\r\n');
            }

            return sdp;
        }

        // Find the line in sdpLines that starts with |prefix|, and, if specified,
        // contains |substr| (case-insensitive search).
        function findLine(sdpLines, prefix, substr) {
            return findLineInRange(sdpLines, 0, -1, prefix, substr);
        }

        // Find the line in sdpLines[startLine...endLine - 1] that starts with |prefix|
        // and, if specified, contains |substr| (case-insensitive search).
        function findLineInRange(sdpLines, startLine, endLine, prefix, substr) {
            var realEndLine = endLine !== -1 ? endLine : sdpLines.length;
            for (var i = startLine; i < realEndLine; ++i) {
                if (sdpLines[i].indexOf(prefix) === 0) {
                    if (!substr ||
                        sdpLines[i].toLowerCase().indexOf(substr.toLowerCase()) !== -1) {
                        return i;
                    }
                }
            }
            return null;
        }

        // Gets the codec payload type from an a=rtpmap:X line.
        function getCodecPayloadType(sdpLine) {
            var pattern = new RegExp('a=rtpmap:(\\d+) \\w+\\/\\d+');
            var result = sdpLine.match(pattern);
            return (result && result.length === 2) ? result[1] : null;
        }

        function setVideoBitrates(sdp, params) {
            params = params || {};
            var xgoogle_min_bitrate = params.min;
            var xgoogle_max_bitrate = params.max;

            var sdpLines = sdp.split('\r\n');

            // VP8
            var vp8Index = findLine(sdpLines, 'a=rtpmap', 'VP8/90000');
            var vp8Payload;
            if (vp8Index) {
                vp8Payload = getCodecPayloadType(sdpLines[vp8Index]);
            }

            if (!vp8Payload) {
                return sdp;
            }

            var rtxIndex = findLine(sdpLines, 'a=rtpmap', 'rtx/90000');
            var rtxPayload;
            if (rtxIndex) {
                rtxPayload = getCodecPayloadType(sdpLines[rtxIndex]);
            }

            if (!rtxIndex) {
                return sdp;
            }

            var rtxFmtpLineIndex = findLine(sdpLines, 'a=fmtp:' + rtxPayload.toString());
            if (rtxFmtpLineIndex !== null) {
                var appendrtxNext = '\r\n';
                appendrtxNext += 'a=fmtp:' + vp8Payload + ' x-google-min-bitrate=' + (xgoogle_min_bitrate || '228') + '; x-google-max-bitrate=' + (xgoogle_max_bitrate || '228');
                sdpLines[rtxFmtpLineIndex] = sdpLines[rtxFmtpLineIndex].concat(appendrtxNext);
                sdp = sdpLines.join('\r\n');
            }

            return sdp;
        }

        function setOpusAttributes(sdp, params) {
            params = params || {};

            var sdpLines = sdp.split('\r\n');

            // Opus
            var opusIndex = findLine(sdpLines, 'a=rtpmap', 'opus/48000');
            var opusPayload;
            if (opusIndex) {
                opusPayload = getCodecPayloadType(sdpLines[opusIndex]);
            }

            if (!opusPayload) {
                return sdp;
            }

            var opusFmtpLineIndex = findLine(sdpLines, 'a=fmtp:' + opusPayload.toString());
            if (opusFmtpLineIndex === null) {
                return sdp;
            }

            var appendOpusNext = '';
            appendOpusNext += '; stereo=' + (typeof params.stereo != 'undefined' ? params.stereo : '1');
            appendOpusNext += '; sprop-stereo=' + (typeof params['sprop-stereo'] != 'undefined' ? params['sprop-stereo'] : '1');

            if (typeof params.maxaveragebitrate != 'undefined') {
                appendOpusNext += '; maxaveragebitrate=' + (params.maxaveragebitrate || 128 * 1024 * 8);
            }

            if (typeof params.maxplaybackrate != 'undefined') {
                appendOpusNext += '; maxplaybackrate=' + (params.maxplaybackrate || 128 * 1024 * 8);
            }

            if (typeof params.cbr != 'undefined') {
                appendOpusNext += '; cbr=' + (typeof params.cbr != 'undefined' ? params.cbr : '1');
            }

            if (typeof params.useinbandfec != 'undefined') {
                appendOpusNext += '; useinbandfec=' + params.useinbandfec;
            }

            if (typeof params.usedtx != 'undefined') {
                appendOpusNext += '; usedtx=' + params.usedtx;
            }

            if (typeof params.maxptime != 'undefined') {
                appendOpusNext += '\r\na=maxptime:' + params.maxptime;
            }

            sdpLines[opusFmtpLineIndex] = sdpLines[opusFmtpLineIndex].concat(appendOpusNext);

            sdp = sdpLines.join('\r\n');
            return sdp;
        }

        // forceStereoAudio => via webrtcexample.com
        // requires getUserMedia => echoCancellation:false
        function forceStereoAudio(sdp) {
            var sdpLines = sdp.split('\r\n');
            var fmtpLineIndex = null;
            for (var i = 0; i < sdpLines.length; i++) {
                if (sdpLines[i].search('opus/48000') !== -1) {
                    var opusPayload = extractSdp(sdpLines[i], /:(\d+) opus\/48000/i);
                    break;
                }
            }
            for (var i = 0; i < sdpLines.length; i++) {
                if (sdpLines[i].search('a=fmtp') !== -1) {
                    var payload = extractSdp(sdpLines[i], /a=fmtp:(\d+)/);
                    if (payload === opusPayload) {
                        fmtpLineIndex = i;
                        break;
                    }
                }
            }
            if (fmtpLineIndex === null) return sdp;
            sdpLines[fmtpLineIndex] = sdpLines[fmtpLineIndex].concat('; stereo=1; sprop-stereo=1');
            sdp = sdpLines.join('\r\n');
            return sdp;
        }

        return {
            removeVPX: removeVPX,
            disableNACK: disableNACK,
            prioritize: prioritize,
            removeNonG722: removeNonG722,
            setApplicationSpecificBandwidth: function(sdp, bandwidth, isScreen) {
                return setBAS(sdp, bandwidth, isScreen);
            },
            setVideoBitrates: function(sdp, params) {
                return setVideoBitrates(sdp, params);
            },
            setOpusAttributes: function(sdp, params) {
                return setOpusAttributes(sdp, params);
            },
            preferVP9: function(sdp) {
                return preferCodec(sdp, 'vp9');
            },
            preferCodec: preferCodec,
            forceStereoAudio: forceStereoAudio
        };
    })();

    // backward compatibility
    window.BandwidthHandler = CodecsHandler;

    // OnIceCandidateHandler.js

    var OnIceCandidateHandler = (function() {
        function processCandidates(connection, icePair) {
            var candidate = icePair.candidate;

            var iceRestrictions = connection.candidates;
            var stun = iceRestrictions.stun;
            var turn = iceRestrictions.turn;

            if (!isNull(iceRestrictions.reflexive)) {
                stun = iceRestrictions.reflexive;
            }

            if (!isNull(iceRestrictions.relay)) {
                turn = iceRestrictions.relay;
            }

            if (!iceRestrictions.host && !!candidate.match(/typ host/g)) {
                return;
            }

            if (!turn && !!candidate.match(/typ relay/g)) {
                return;
            }

            if (!stun && !!candidate.match(/typ srflx/g)) {
                return;
            }

            var protocol = connection.iceProtocols;

            if (!protocol.udp && !!candidate.match(/ udp /g)) {
                return;
            }

            if (!protocol.tcp && !!candidate.match(/ tcp /g)) {
                return;
            }

            if (connection.enableLogs) {
                console.debug('Your candidate pairs:', candidate);
            }

            return {
                candidate: candidate,
                sdpMid: icePair.sdpMid,
                sdpMLineIndex: icePair.sdpMLineIndex
            };
        }

        return {
            processCandidates: processCandidates
        };
    })();

    // IceServersHandler.js

    var IceServersHandler = (function() {
        function getIceServers(connection) {
            // resiprocate: 3344+4433
            // pions: 7575
            var iceServers = [{
                'urls': [
                    'stun:stun.l.google.com:19302',
                    'stun:stun1.l.google.com:19302',
                    'stun:stun2.l.google.com:19302',
                    'stun:stun.l.google.com:19302?transport=udp',
                ]
            }];

            return iceServers;
        }

        return {
            getIceServers: getIceServers
        };
    })();

    // getUserMediaHandler.js

    function setStreamType(constraints, stream) {
        if (constraints.mandatory && constraints.mandatory.chromeMediaSource) {
            stream.isScreen = true;
        } else if (constraints.mozMediaSource || constraints.mediaSource) {
            stream.isScreen = true;
        } else if (constraints.video) {
            stream.isVideo = true;
        } else if (constraints.audio) {
            stream.isAudio = true;
        }
    }

    // allow users to manage this object (to support re-capturing of screen/etc.)
    window.currentUserMediaRequest = {
        streams: [],
        mutex: false,
        queueRequests: [],
        remove: function(idInstance) {
            this.mutex = false;

            var stream = this.streams[idInstance];
            if (!stream) {
                return;
            }

            stream = stream.stream;

            var options = stream.currentUserMediaRequestOptions;

            if (this.queueRequests.indexOf(options)) {
                delete this.queueRequests[this.queueRequests.indexOf(options)];
                this.queueRequests = removeNullEntries(this.queueRequests);
            }

            this.streams[idInstance].stream = null;
            delete this.streams[idInstance];
        }
    };

    function getUserMediaHandler(options) {
        if (currentUserMediaRequest.mutex === true) {
            currentUserMediaRequest.queueRequests.push(options);
            return;
        }
        currentUserMediaRequest.mutex = true;

        // easy way to match
        var idInstance = JSON.stringify(options.localMediaConstraints);

        function streaming(stream, returnBack) {
            setStreamType(options.localMediaConstraints, stream);

            var streamEndedEvent = 'ended';

            if ('oninactive' in stream) {
                streamEndedEvent = 'inactive';
            }
            stream.addEventListener(streamEndedEvent, function() {
                delete currentUserMediaRequest.streams[idInstance];

                currentUserMediaRequest.mutex = false;
                if (currentUserMediaRequest.queueRequests.indexOf(options)) {
                    delete currentUserMediaRequest.queueRequests[currentUserMediaRequest.queueRequests.indexOf(options)];
                    currentUserMediaRequest.queueRequests = removeNullEntries(currentUserMediaRequest.queueRequests);
                }
            }, false);

            currentUserMediaRequest.streams[idInstance] = {
                stream: stream
            };
            currentUserMediaRequest.mutex = false;

            if (currentUserMediaRequest.queueRequests.length) {
                getUserMediaHandler(currentUserMediaRequest.queueRequests.shift());
            }

            // callback
            options.onGettingLocalMedia(stream, returnBack);
        }

        if (currentUserMediaRequest.streams[idInstance]) {
            streaming(currentUserMediaRequest.streams[idInstance].stream, true);
        } else {
            var isBlackBerry = !!(/BB10|BlackBerry/i.test(navigator.userAgent || ''));
            if (isBlackBerry || typeof navigator.mediaDevices === 'undefined' || typeof navigator.mediaDevices.getUserMedia !== 'function') {
                navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
                navigator.getUserMedia(options.localMediaConstraints, function(stream) {
                    stream.streamid = stream.streamid || stream.id || getRandomString();
                    stream.idInstance = idInstance;
                    streaming(stream);
                }, function(error) {
                    options.onLocalMediaError(error, options.localMediaConstraints);
                });
                return;
            }

            if (typeof navigator.mediaDevices === 'undefined') {
                navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
                var getUserMediaSuccess = function() {};
                var getUserMediaFailure = function() {};

                var getUserMediaStream, getUserMediaError;
                navigator.mediaDevices = {
                    getUserMedia: function(hints) {
                        navigator.getUserMedia(hints, function(getUserMediaSuccess) {
                            getUserMediaSuccess(stream);
                            getUserMediaStream = stream;
                        }, function(error) {
                            getUserMediaFailure(error);
                            getUserMediaError = error;
                        });

                        return {
                            then: function(successCB) {
                                if (getUserMediaStream) {
                                    successCB(getUserMediaStream);
                                    return;
                                }

                                getUserMediaSuccess = successCB;

                                return {
                                    then: function(failureCB) {
                                        if (getUserMediaError) {
                                            failureCB(getUserMediaError);
                                            return;
                                        }

                                        getUserMediaFailure = failureCB;
                                    }
                                }
                            }
                        }
                    }
                };
            }

            if (options.localMediaConstraints.isScreen === true) {
                if (navigator.mediaDevices.getDisplayMedia) {
                    navigator.mediaDevices.getDisplayMedia(options.localMediaConstraints).then(function(stream) {
                        stream.streamid = stream.streamid || stream.id || getRandomString();
                        stream.idInstance = idInstance;

                        streaming(stream);
                    }).catch(function(error) {
                        options.onLocalMediaError(error, options.localMediaConstraints);
                    });
                } else if (navigator.getDisplayMedia) {
                    navigator.getDisplayMedia(options.localMediaConstraints).then(function(stream) {
                        stream.streamid = stream.streamid || stream.id || getRandomString();
                        stream.idInstance = idInstance;

                        streaming(stream);
                    }).catch(function(error) {
                        options.onLocalMediaError(error, options.localMediaConstraints);
                    });
                } else {
                    throw new Error('getDisplayMedia API is not availabe in this browser.');
                }
                return;
            }

            navigator.mediaDevices.getUserMedia(options.localMediaConstraints).then(function(stream) {
                stream.streamid = stream.streamid || stream.id || getRandomString();
                stream.idInstance = idInstance;

                streaming(stream);
            }).catch(function(error) {
                options.onLocalMediaError(error, options.localMediaConstraints);
            });
        }
    }

    // StreamsHandler.js

    var StreamsHandler = (function() {
        function handleType(type) {
            if (!type) {
                return;
            }

            if (typeof type === 'string' || typeof type === 'undefined') {
                return type;
            }

            if (type.audio && type.video) {
                return null;
            }

            if (type.audio) {
                return 'audio';
            }

            if (type.video) {
                return 'video';
            }

            return;
        }

        function setHandlers(stream, syncAction, connection) {
            if (!stream || !stream.addEventListener) return;

            if (typeof syncAction == 'undefined' || syncAction == true) {
                var streamEndedEvent = 'ended';

                if ('oninactive' in stream) {
                    streamEndedEvent = 'inactive';
                }

                stream.addEventListener(streamEndedEvent, function() {
                    StreamsHandler.onSyncNeeded(this.streamid, streamEndedEvent);
                }, false);
            }

            stream.mute = function(type, isSyncAction) {
                type = handleType(type);

                if (typeof isSyncAction !== 'undefined') {
                    syncAction = isSyncAction;
                }

                if (typeof type == 'undefined' || type == 'audio') {
                    getTracks(stream, 'audio').forEach(function(track) {
                        track.enabled = false;
                        connection.streamEvents[stream.streamid].isAudioMuted = true;
                    });
                }

                if (typeof type == 'undefined' || type == 'video') {
                    getTracks(stream, 'video').forEach(function(track) {
                        track.enabled = false;
                    });
                }

                if (typeof syncAction == 'undefined' || syncAction == true) {
                    StreamsHandler.onSyncNeeded(stream.streamid, 'mute', type);
                }

                connection.streamEvents[stream.streamid].muteType = type || 'both';

                fireEvent(stream, 'mute', type);
            };

            stream.unmute = function(type, isSyncAction) {
                type = handleType(type);

                if (typeof isSyncAction !== 'undefined') {
                    syncAction = isSyncAction;
                }

                graduallyIncreaseVolume();

                if (typeof type == 'undefined' || type == 'audio') {
                    getTracks(stream, 'audio').forEach(function(track) {
                        track.enabled = true;
                        connection.streamEvents[stream.streamid].isAudioMuted = false;
                    });
                }

                if (typeof type == 'undefined' || type == 'video') {
                    getTracks(stream, 'video').forEach(function(track) {
                        track.enabled = true;
                    });

                    // make sure that video unmute doesn't affects audio
                    if (typeof type !== 'undefined' && type == 'video' && connection.streamEvents[stream.streamid].isAudioMuted) {
                        (function looper(times) {
                            if (!times) {
                                times = 0;
                            }

                            times++;

                            // check until five-seconds
                            if (times < 100 && connection.streamEvents[stream.streamid].isAudioMuted) {
                                stream.mute('audio');

                                setTimeout(function() {
                                    looper(times);
                                }, 50);
                            }
                        })();
                    }
                }

                if (typeof syncAction == 'undefined' || syncAction == true) {
                    StreamsHandler.onSyncNeeded(stream.streamid, 'unmute', type);
                }

                connection.streamEvents[stream.streamid].unmuteType = type || 'both';

                fireEvent(stream, 'unmute', type);
            };

            function graduallyIncreaseVolume() {
                if (!connection.streamEvents[stream.streamid].mediaElement) {
                    return;
                }

                var mediaElement = connection.streamEvents[stream.streamid].mediaElement;
                mediaElement.volume = 0;
                afterEach(200, 5, function() {
                    try {
                        mediaElement.volume += .20;
                    } catch (e) {
                        mediaElement.volume = 1;
                    }
                });
            }
        }

        function afterEach(setTimeoutInteval, numberOfTimes, callback, startedTimes) {
            startedTimes = (startedTimes || 0) + 1;
            if (startedTimes >= numberOfTimes) return;

            setTimeout(function() {
                callback();
                afterEach(setTimeoutInteval, numberOfTimes, callback, startedTimes);
            }, setTimeoutInteval);
        }

        return {
            setHandlers: setHandlers,
            onSyncNeeded: function(streamid, action, type) {}
        };
    })();

    // TextReceiver.js & TextSender.js

    function TextReceiver(connection) {
        var content = {};

        function receive(data, userid, extra) {
            // uuid is used to uniquely identify sending instance
            var uuid = data.uuid;
            if (!content[uuid]) {
                content[uuid] = [];
            }

            content[uuid].push(data.message);

            if (data.last) {
                var message = content[uuid].join('');
                if (data.isobject) {
                    message = JSON.parse(message);
                }

                // latency detection
                var receivingTime = new Date().getTime();
                var latency = receivingTime - data.sendingTime;

                var e = {
                    data: message,
                    userid: userid,
                    extra: extra,
                    latency: latency
                };

                if (connection.autoTranslateText) {
                    e.original = e.data;
                    connection.Translator.TranslateText(e.data, function(translatedText) {
                        e.data = translatedText;
                        connection.onmessage(e);
                    });
                } else {
                    connection.onmessage(e);
                }

                delete content[uuid];
            }
        }

        return {
            receive: receive
        };
    }

    // TextSender.js
    var TextSender = {
        send: function(config) {
            var connection = config.connection;

            var channel = config.channel,
                remoteUserId = config.remoteUserId,
                initialText = config.text,
                packetSize = connection.chunkSize || 1000,
                textToTransfer = '',
                isobject = false;

            if (!isString(initialText)) {
                isobject = true;
                initialText = JSON.stringify(initialText);
            }

            // uuid is used to uniquely identify sending instance
            var uuid = getRandomString();
            var sendingTime = new Date().getTime();

            sendText(initialText);

            function sendText(textMessage, text) {
                var data = {
                    type: 'text',
                    uuid: uuid,
                    sendingTime: sendingTime
                };

                if (textMessage) {
                    text = textMessage;
                    data.packets = parseInt(text.length / packetSize);
                }

                if (text.length > packetSize) {
                    data.message = text.slice(0, packetSize);
                } else {
                    data.message = text;
                    data.last = true;
                    data.isobject = isobject;
                }

                channel.send(data, remoteUserId);

                textToTransfer = text.slice(data.message.length);

                if (textToTransfer.length) {
                    setTimeout(function() {
                        sendText(null, textToTransfer);
                    }, connection.chunkInterval || 100);
                }
            }
        }
    };

    // FileProgressBarHandler.js

    var FileProgressBarHandler = (function() {
        function handle(connection) {
            var progressHelper = {};

            // www.RTCMultiConnection.org/docs/onFileStart/
            connection.onFileStart = function(file) {
                var div = document.createElement('div');
                div.title = file.name;
                div.innerHTML = '<label>0%</label> <progress></progress>';

                if (file.remoteUserId) {
                    div.innerHTML += ' (Sharing with:' + file.remoteUserId + ')';
                }

                if (!connection.filesContainer) {
                    connection.filesContainer = document.body || document.documentElement;
                }

                connection.filesContainer.insertBefore(div, connection.filesContainer.firstChild);

                if (!file.remoteUserId) {
                    progressHelper[file.uuid] = {
                        div: div,
                        progress: div.querySelector('progress'),
                        label: div.querySelector('label')
                    };
                    progressHelper[file.uuid].progress.max = file.maxChunks;
                    return;
                }

                if (!progressHelper[file.uuid]) {
                    progressHelper[file.uuid] = {};
                }

                progressHelper[file.uuid][file.remoteUserId] = {
                    div: div,
                    progress: div.querySelector('progress'),
                    label: div.querySelector('label')
                };
                progressHelper[file.uuid][file.remoteUserId].progress.max = file.maxChunks;
            };

            // www.RTCMultiConnection.org/docs/onFileProgress/
            connection.onFileProgress = function(chunk) {
                var helper = progressHelper[chunk.uuid];
                if (!helper) {
                    return;
                }
                if (chunk.remoteUserId) {
                    helper = progressHelper[chunk.uuid][chunk.remoteUserId];
                    if (!helper) {
                        return;
                    }
                }

                helper.progress.value = chunk.currentPosition || chunk.maxChunks || helper.progress.max;
                updateLabel(helper.progress, helper.label);
            };

            // www.RTCMultiConnection.org/docs/onFileEnd/
            connection.onFileEnd = function(file) {
                var helper = progressHelper[file.uuid];
                if (!helper) {
                    console.error('No such progress-helper element exist.', file);
                    return;
                }

                if (file.remoteUserId) {
                    helper = progressHelper[file.uuid][file.remoteUserId];
                    if (!helper) {
                        return;
                    }
                }

                var div = helper.div;
                if (file.type.indexOf('image') != -1) {
                    div.innerHTML = '<a href="' + file.url + '" download="' + file.name + '">Download <strong style="color:red;">' + file.name + '</strong> </a><br /><img src="' + file.url + '" title="' + file.name + '" style="max-width: 80%;">';
                } else {
                    div.innerHTML = '<a href="' + file.url + '" download="' + file.name + '">Download <strong style="color:red;">' + file.name + '</strong> </a><br /><iframe src="' + file.url + '" title="' + file.name + '" style="width: 80%;border: 0;height: inherit;margin-top:1em;"></iframe>';
                }
            };

            function updateLabel(progress, label) {
                if (progress.position === -1) {
                    return;
                }

                var position = +progress.position.toFixed(2).split('.')[1] || 100;
                label.innerHTML = position + '%';
            }
        }

        return {
            handle: handle
        };
    })();

    // TranslationHandler.js

    var TranslationHandler = (function() {
        function handle(connection) {
            connection.autoTranslateText = false;
            connection.language = 'en';
            connection.googKey = 'AIzaSyCgB5hmFY74WYB-EoWkhr9cAGr6TiTHrEE';

            // www.RTCMultiConnection.org/docs/Translator/
            connection.Translator = {
                TranslateText: function(text, callback) {
                    // if(location.protocol === 'https:') return callback(text);

                    var newScript = document.createElement('script');
                    newScript.type = 'text/javascript';

                    var sourceText = encodeURIComponent(text); // escape

                    var randomNumber = 'method' + connection.token();
                    window[randomNumber] = function(response) {
                        if (response.data && response.data.translations[0] && callback) {
                            callback(response.data.translations[0].translatedText);
                            return;
                        }

                        if (response.error && response.error.message === 'Daily Limit Exceeded') {
                            console.error('Text translation failed. Error message: "Daily Limit Exceeded."');
                            return;
                        }

                        if (response.error) {
                            console.error(response.error.message);
                            return;
                        }

                        console.error(response);
                    };

                    var source = 'https://www.googleapis.com/language/translate/v2?key=' + connection.googKey + '&target=' + (connection.language || 'en-US') + '&callback=window.' + randomNumber + '&q=' + sourceText;
                    newScript.src = source;
                    document.getElementsByTagName('head')[0].appendChild(newScript);
                },
                getListOfLanguages: function(callback) {
                    var xhr = new XMLHttpRequest();
                    xhr.onreadystatechange = function() {
                        if (xhr.readyState == XMLHttpRequest.DONE) {
                            var response = JSON.parse(xhr.responseText);

                            if (response && response.data && response.data.languages) {
                                callback(response.data.languages);
                                return;
                            }

                            if (response.error && response.error.message === 'Daily Limit Exceeded') {
                                console.error('Text translation failed. Error message: "Daily Limit Exceeded."');
                                return;
                            }

                            if (response.error) {
                                console.error(response.error.message);
                                return;
                            }

                            console.error(response);
                        }
                    }
                    var url = 'https://www.googleapis.com/language/translate/v2/languages?key=' + connection.googKey + '&target=en';
                    xhr.open('GET', url, true);
                    xhr.send(null);
                }
            };
        }

        return {
            handle: handle
        };
    })();

    // _____________________
    // RTCMultiConnection.js

    (function(connection) {
        forceOptions = forceOptions || {
            useDefaultDevices: true
        };

        connection.channel = connection.sessionid = (roomid || location.href.replace(/\/|:|#|\?|\$|\^|%|\.|`|~|!|\+|@|\[|\||]|\|*. /g, '').split('\n').join('').split('\r').join('')) + '';

        var mPeer = new MultiPeers(connection);

        var preventDuplicateOnStreamEvents = {};
        mPeer.onGettingLocalMedia = function(stream, callback) {
            callback = callback || function() {};

            if (preventDuplicateOnStreamEvents[stream.streamid]) {
                callback();
                return;
            }
            preventDuplicateOnStreamEvents[stream.streamid] = true;

            try {
                stream.type = 'local';
            } catch (e) {}

            connection.setStreamEndHandler(stream);

            getRMCMediaElement(stream, function(mediaElement) {
                mediaElement.id = stream.streamid;
                mediaElement.muted = true;
                mediaElement.volume = 0;

                if (connection.attachStreams.indexOf(stream) === -1) {
                    connection.attachStreams.push(stream);
                }

                if (typeof StreamsHandler !== 'undefined') {
                    StreamsHandler.setHandlers(stream, true, connection);
                }
                var isAudioMuted = stream.getAudioTracks().filter(function(track) {
                    return track.enabled;
                }).length === 0;

                connection.streamEvents[stream.streamid] = {
                    stream: stream,
                    type: 'local',
                    mediaElement: mediaElement,
                    userid: connection.userid,
                    extra: connection.extra,
                    streamid: stream.streamid,
                    isAudioMuted: isAudioMuted
                };

                try {
                    setHarkEvents(connection, connection.streamEvents[stream.streamid]);
                    setMuteHandlers(connection, connection.streamEvents[stream.streamid]);

                    connection.onstream(connection.streamEvents[stream.streamid]);
                } catch (e) {
                    //
                }

                callback();
            }, connection);
        };

        mPeer.onGettingRemoteMedia = function(stream, remoteUserId) {
            try {
                stream.type = 'remote';
            } catch (e) {}

            connection.setStreamEndHandler(stream, 'remote-stream');

            getRMCMediaElement(stream, function(mediaElement) {
                mediaElement.id = stream.streamid;

                if (typeof StreamsHandler !== 'undefined') {
                    StreamsHandler.setHandlers(stream, false, connection);
                }

                connection.streamEvents[stream.streamid] = {
                    stream: stream,
                    type: 'remote',
                    userid: remoteUserId,
                    extra: connection.peers[remoteUserId] ? connection.peers[remoteUserId].extra : {},
                    mediaElement: mediaElement,
                    streamid: stream.streamid
                };

                setMuteHandlers(connection, connection.streamEvents[stream.streamid]);

                connection.onstream(connection.streamEvents[stream.streamid]);
            }, connection);
        };

        mPeer.onRemovingRemoteMedia = function(stream, remoteUserId) {
            var streamEvent = connection.streamEvents[stream.streamid];
            if (!streamEvent) {
                streamEvent = {
                    stream: stream,
                    type: 'remote',
                    userid: remoteUserId,
                    extra: connection.peers[remoteUserId] ? connection.peers[remoteUserId].extra : {},
                    streamid: stream.streamid,
                    mediaElement: connection.streamEvents[stream.streamid] ? connection.streamEvents[stream.streamid].mediaElement : null
                };
            }

            if (connection.peersBackup[streamEvent.userid]) {
                streamEvent.extra = connection.peersBackup[streamEvent.userid].extra;
            }

            connection.onstreamended(streamEvent);

            delete connection.streamEvents[stream.streamid];
        };

        mPeer.onNegotiationNeeded = function(message, remoteUserId, callback) {
            callback = callback || function() {};

            remoteUserId = remoteUserId || message.remoteUserId;
            message = message || '';

            // usually a message looks like this
            var messageToDeliver = {
                remoteUserId: remoteUserId,
                message: message,
                sender: connection.userid
            };

            if (message.remoteUserId && message.message && message.sender) {
                // if a code is manually passing required data
                messageToDeliver = message;
            }

            connectSocket(function() {
                connection.socket.emit(connection.socketMessageEvent, messageToDeliver, callback);
            });
        };

        function onUserLeft(remoteUserId) {
            connection.deletePeer(remoteUserId);
        }

        mPeer.onUserLeft = onUserLeft;
        mPeer.disconnectWith = function(remoteUserId, callback) {
            if (connection.socket) {
                connection.socket.emit('disconnect-with', remoteUserId, callback || function() {});
            }

            connection.deletePeer(remoteUserId);
        };

        connection.socketOptions = {
            // 'force new connection': true, // For SocketIO version < 1.0
            // 'forceNew': true, // For SocketIO version >= 1.0
            'transport': 'polling' // fixing transport:unknown issues
        };

        function connectSocket(connectCallback) {
            connection.socketAutoReConnect = true;

            if (connection.socket) { // todo: check here readySate/etc. to make sure socket is still opened
                if (connectCallback) {
                    connectCallback(connection.socket);
                }
                return;
            }

            if (typeof SocketConnection === 'undefined') {
                if (typeof FirebaseConnection !== 'undefined') {
                    window.SocketConnection = FirebaseConnection;
                } else if (typeof PubNubConnection !== 'undefined') {
                    window.SocketConnection = PubNubConnection;
                } else {
                    throw 'SocketConnection.js seems missed.';
                }
            }

            new SocketConnection(connection, function(s) {
                if (connectCallback) {
                    connectCallback(connection.socket);
                }
            });
        }

        // 1st paramter is roomid
        // 2rd paramter is a callback function
        connection.openOrJoin = function(roomid, callback) {
            callback = callback || function() {};

            connection.checkPresence(roomid, function(isRoomExist, roomid) {
                if (isRoomExist) {
                    connection.sessionid = roomid;

                    var localPeerSdpConstraints = false;
                    var remotePeerSdpConstraints = false;
                    var isOneWay = !!connection.session.oneway;
                    var isDataOnly = isData(connection.session);

                    remotePeerSdpConstraints = {
                        OfferToReceiveAudio: connection.sdpConstraints.mandatory.OfferToReceiveAudio,
                        OfferToReceiveVideo: connection.sdpConstraints.mandatory.OfferToReceiveVideo
                    }

                    localPeerSdpConstraints = {
                        OfferToReceiveAudio: isOneWay ? !!connection.session.audio : connection.sdpConstraints.mandatory.OfferToReceiveAudio,
                        OfferToReceiveVideo: isOneWay ? !!connection.session.video || !!connection.session.screen : connection.sdpConstraints.mandatory.OfferToReceiveVideo
                    }

                    var connectionDescription = {
                        remoteUserId: connection.sessionid,
                        message: {
                            newParticipationRequest: true,
                            isOneWay: isOneWay,
                            isDataOnly: isDataOnly,
                            localPeerSdpConstraints: localPeerSdpConstraints,
                            remotePeerSdpConstraints: remotePeerSdpConstraints
                        },
                        sender: connection.userid
                    };

                    beforeJoin(connectionDescription.message, function() {
                        joinRoom(connectionDescription, callback);
                    });
                    return;
                }

                connection.waitingForLocalMedia = true;
                connection.isInitiator = true;

                connection.sessionid = roomid || connection.sessionid;

                if (isData(connection.session)) {
                    openRoom(callback);
                    return;
                }

                connection.captureUserMedia(function() {
                    openRoom(callback);
                });
            });
        };

        // don't allow someone to join this person until he has the media
        connection.waitingForLocalMedia = false;

        connection.open = function(roomid, callback) {
            callback = callback || function() {};

            connection.waitingForLocalMedia = true;
            connection.isInitiator = true;

            connection.sessionid = roomid || connection.sessionid;

            connectSocket(function() {
                if (isData(connection.session)) {
                    openRoom(callback);
                    return;
                }

                connection.captureUserMedia(function() {
                    openRoom(callback);
                });
            });
        };

        // this object keeps extra-data records for all connected users
        // this object is never cleared so you can always access extra-data even if a user left
        connection.peersBackup = {};

        connection.deletePeer = function(remoteUserId) {
            if (!remoteUserId || !connection.peers[remoteUserId]) {
                return;
            }

            var eventObject = {
                userid: remoteUserId,
                extra: connection.peers[remoteUserId] ? connection.peers[remoteUserId].extra : {}
            };

            if (connection.peersBackup[eventObject.userid]) {
                eventObject.extra = connection.peersBackup[eventObject.userid].extra;
            }

            connection.onleave(eventObject);

            if (!!connection.peers[remoteUserId]) {
                connection.peers[remoteUserId].streams.forEach(function(stream) {
                    stream.stop();
                });

                var peer = connection.peers[remoteUserId].peer;
                if (peer && peer.iceConnectionState !== 'closed') {
                    try {
                        peer.close();
                    } catch (e) {}
                }

                if (connection.peers[remoteUserId]) {
                    connection.peers[remoteUserId].peer = null;
                    delete connection.peers[remoteUserId];
                }
            }
        }

        connection.rejoin = function(connectionDescription) {
            if (connection.isInitiator || !connectionDescription || !Object.keys(connectionDescription).length) {
                return;
            }

            var extra = {};

            if (connection.peers[connectionDescription.remoteUserId]) {
                extra = connection.peers[connectionDescription.remoteUserId].extra;
                connection.deletePeer(connectionDescription.remoteUserId);
            }

            if (connectionDescription && connectionDescription.remoteUserId) {
                connection.join(connectionDescription.remoteUserId);

                connection.onReConnecting({
                    userid: connectionDescription.remoteUserId,
                    extra: extra
                });
            }
        };

        connection.join = function(remoteUserId, options) {
            connection.sessionid = (remoteUserId ? remoteUserId.sessionid || remoteUserId.remoteUserId || remoteUserId : false) || connection.sessionid;
            connection.sessionid += '';

            var localPeerSdpConstraints = false;
            var remotePeerSdpConstraints = false;
            var isOneWay = false;
            var isDataOnly = false;

            if ((remoteUserId && remoteUserId.session) || !remoteUserId || typeof remoteUserId === 'string') {
                var session = remoteUserId ? remoteUserId.session || connection.session : connection.session;

                isOneWay = !!session.oneway;
                isDataOnly = isData(session);

                remotePeerSdpConstraints = {
                    OfferToReceiveAudio: connection.sdpConstraints.mandatory.OfferToReceiveAudio,
                    OfferToReceiveVideo: connection.sdpConstraints.mandatory.OfferToReceiveVideo
                };

                localPeerSdpConstraints = {
                    OfferToReceiveAudio: isOneWay ? !!connection.session.audio : connection.sdpConstraints.mandatory.OfferToReceiveAudio,
                    OfferToReceiveVideo: isOneWay ? !!connection.session.video || !!connection.session.screen : connection.sdpConstraints.mandatory.OfferToReceiveVideo
                };
            }

            options = options || {};

            var cb = function() {};
            if (typeof options === 'function') {
                cb = options;
                options = {};
            }

            if (typeof options.localPeerSdpConstraints !== 'undefined') {
                localPeerSdpConstraints = options.localPeerSdpConstraints;
            }

            if (typeof options.remotePeerSdpConstraints !== 'undefined') {
                remotePeerSdpConstraints = options.remotePeerSdpConstraints;
            }

            if (typeof options.isOneWay !== 'undefined') {
                isOneWay = options.isOneWay;
            }

            if (typeof options.isDataOnly !== 'undefined') {
                isDataOnly = options.isDataOnly;
            }

            var connectionDescription = {
                remoteUserId: connection.sessionid,
                message: {
                    newParticipationRequest: true,
                    isOneWay: isOneWay,
                    isDataOnly: isDataOnly,
                    localPeerSdpConstraints: localPeerSdpConstraints,
                    remotePeerSdpConstraints: remotePeerSdpConstraints
                },
                sender: connection.userid
            };

            beforeJoin(connectionDescription.message, function() {
                connectSocket(function() {
                    joinRoom(connectionDescription, cb);
                });
            });
            return connectionDescription;
        };

        function joinRoom(connectionDescription, cb) {
            connection.socket.emit('join-room', {
                sessionid: connection.sessionid,
                session: connection.session,
                mediaConstraints: connection.mediaConstraints,
                sdpConstraints: connection.sdpConstraints,
                streams: getStreamInfoForAdmin(),
                extra: connection.extra,
                password: typeof connection.password !== 'undefined' && typeof connection.password !== 'object' ? connection.password : ''
            }, function(isRoomJoined, error) {
                if (isRoomJoined === true) {
                    if (connection.enableLogs) {
                        console.log('isRoomJoined: ', isRoomJoined, ' roomid: ', connection.sessionid);
                    }

                    if (!!connection.peers[connection.sessionid]) {
                        // on socket disconnect & reconnect
                        return;
                    }

                    mPeer.onNegotiationNeeded(connectionDescription);
                }

                if (isRoomJoined === false) {
                    if (connection.enableLogs) {
                        console.warn('isRoomJoined: ', error, ' roomid: ', connection.sessionid);
                    }

                    // [disabled] retry after 3 seconds
                    false && setTimeout(function() {
                        joinRoom(connectionDescription, cb);
                    }, 3000);
                }

                cb(isRoomJoined, connection.sessionid, error);
            });
        }

        connection.publicRoomIdentifier = '';

        function openRoom(callback) {
            if (connection.enableLogs) {
                console.log('Sending open-room signal to socket.io');
            }

            connection.waitingForLocalMedia = false;
            connection.socket.emit('open-room', {
                sessionid: connection.sessionid,
                session: connection.session,
                mediaConstraints: connection.mediaConstraints,
                sdpConstraints: connection.sdpConstraints,
                streams: getStreamInfoForAdmin(),
                extra: connection.extra,
                identifier: connection.publicRoomIdentifier,
                password: typeof connection.password !== 'undefined' && typeof connection.password !== 'object' ? connection.password : ''
            }, function(isRoomOpened, error) {
                if (isRoomOpened === true) {
                    if (connection.enableLogs) {
                        console.log('isRoomOpened: ', isRoomOpened, ' roomid: ', connection.sessionid);
                    }
                    callback(isRoomOpened, connection.sessionid);
                }

                if (isRoomOpened === false) {
                    if (connection.enableLogs) {
                        console.warn('isRoomOpened: ', error, ' roomid: ', connection.sessionid);
                    }

                    callback(isRoomOpened, connection.sessionid, error);
                }
            });
        }

        function getStreamInfoForAdmin() {
            try {
                return connection.streamEvents.selectAll('local').map(function(event) {
                    return {
                        streamid: event.streamid,
                        tracks: event.stream.getTracks().length
                    };
                });
            } catch (e) {
                return [];
            }
        }

        function beforeJoin(userPreferences, callback) {
            if (connection.dontCaptureUserMedia || userPreferences.isDataOnly) {
                callback();
                return;
            }

            var localMediaConstraints = {};

            if (userPreferences.localPeerSdpConstraints.OfferToReceiveAudio) {
                localMediaConstraints.audio = connection.mediaConstraints.audio;
            }

            if (userPreferences.localPeerSdpConstraints.OfferToReceiveVideo) {
                localMediaConstraints.video = connection.mediaConstraints.video;
            }

            var session = userPreferences.session || connection.session;

            if (session.oneway && session.audio !== 'two-way' && session.video !== 'two-way' && session.screen !== 'two-way') {
                callback();
                return;
            }

            if (session.oneway && session.audio && session.audio === 'two-way') {
                session = {
                    audio: true
                };
            }

            if (session.audio || session.video || session.screen) {
                if (session.screen) {
                    if (DetectRTC.browser.name === 'Edge') {
                        navigator.getDisplayMedia({
                            video: true,
                            audio: isAudioPlusTab(connection)
                        }).then(function(screen) {
                            screen.isScreen = true;
                            mPeer.onGettingLocalMedia(screen);

                            if ((session.audio || session.video) && !isAudioPlusTab(connection)) {
                                connection.invokeGetUserMedia(null, callback);
                            } else {
                                callback(screen);
                            }
                        }, function(error) {
                            console.error('Unable to capture screen on Edge. HTTPs and version 17+ is required.');
                        });
                    } else {
                        connection.invokeGetUserMedia({
                            audio: isAudioPlusTab(connection),
                            video: true,
                            isScreen: true
                        }, (session.audio || session.video) && !isAudioPlusTab(connection) ? connection.invokeGetUserMedia(null, callback) : callback);
                    }
                } else if (session.audio || session.video) {
                    connection.invokeGetUserMedia(null, callback, session);
                }
            }
        }

        connection.getUserMedia = connection.captureUserMedia = function(callback, sessionForced) {
            callback = callback || function() {};
            var session = sessionForced || connection.session;

            if (connection.dontCaptureUserMedia || isData(session)) {
                callback();
                return;
            }

            if (session.audio || session.video || session.screen) {
                if (session.screen) {
                    if (DetectRTC.browser.name === 'Edge') {
                        navigator.getDisplayMedia({
                            video: true,
                            audio: isAudioPlusTab(connection)
                        }).then(function(screen) {
                            screen.isScreen = true;
                            mPeer.onGettingLocalMedia(screen);

                            if ((session.audio || session.video) && !isAudioPlusTab(connection)) {
                                var nonScreenSession = {};
                                for (var s in session) {
                                    if (s !== 'screen') {
                                        nonScreenSession[s] = session[s];
                                    }
                                }
                                connection.invokeGetUserMedia(sessionForced, callback, nonScreenSession);
                                return;
                            }
                            callback(screen);
                        }, function(error) {
                            console.error('Unable to capture screen on Edge. HTTPs and version 17+ is required.');
                        });
                    } else {
                        connection.invokeGetUserMedia({
                            audio: isAudioPlusTab(connection),
                            video: true,
                            isScreen: true
                        }, function(stream) {
                            if ((session.audio || session.video) && !isAudioPlusTab(connection)) {
                                var nonScreenSession = {};
                                for (var s in session) {
                                    if (s !== 'screen') {
                                        nonScreenSession[s] = session[s];
                                    }
                                }
                                connection.invokeGetUserMedia(sessionForced, callback, nonScreenSession);
                                return;
                            }
                            callback(stream);
                        });
                    }
                } else if (session.audio || session.video) {
                    connection.invokeGetUserMedia(sessionForced, callback, session);
                }
            }
        };

        connection.onbeforeunload = function(arg1, dontCloseSocket) {
            if (!connection.closeBeforeUnload) {
                return;
            }

            connection.peers.getAllParticipants().forEach(function(participant) {
                mPeer.onNegotiationNeeded({
                    userLeft: true
                }, participant);

                if (connection.peers[participant] && connection.peers[participant].peer) {
                    connection.peers[participant].peer.close();
                }

                delete connection.peers[participant];
            });

            if (!dontCloseSocket) {
                connection.closeSocket();
            }

            connection.isInitiator = false;
        };

        if (!window.ignoreBeforeUnload) {
            // user can implement its own version of window.onbeforeunload
            connection.closeBeforeUnload = true;
            window.addEventListener('beforeunload', connection.onbeforeunload, false);
        } else {
            connection.closeBeforeUnload = false;
        }

        connection.userid = getRandomString();
        connection.changeUserId = function(newUserId, callback) {
            callback = callback || function() {};
            connection.userid = newUserId || getRandomString();
            connection.socket.emit('changed-uuid', connection.userid, callback);
        };

        connection.extra = {};
        connection.attachStreams = [];

        connection.session = {
            audio: true,
            video: true
        };

        connection.enableFileSharing = false;

        // all values in kbps
        connection.bandwidth = {
            screen: false,
            audio: false,
            video: false
        };

        connection.codecs = {
            audio: 'opus',
            video: 'VP9'
        };

        connection.processSdp = function(sdp) {
            // ignore SDP modification if unified-pan is supported
            if (isUnifiedPlanSupportedDefault()) {
                return sdp;
            }

            if (DetectRTC.browser.name === 'Safari') {
                return sdp;
            }

            if (connection.codecs.video.toUpperCase() === 'VP8') {
                sdp = CodecsHandler.preferCodec(sdp, 'vp8');
            }

            if (connection.codecs.video.toUpperCase() === 'VP9') {
                sdp = CodecsHandler.preferCodec(sdp, 'vp9');
            }

            if (connection.codecs.video.toUpperCase() === 'H264') {
                sdp = CodecsHandler.preferCodec(sdp, 'h264');
            }

            if (connection.codecs.audio === 'G722') {
                sdp = CodecsHandler.removeNonG722(sdp);
            }

            if (DetectRTC.browser.name === 'Firefox') {
                return sdp;
            }

            if (connection.bandwidth.video || connection.bandwidth.screen) {
                sdp = CodecsHandler.setApplicationSpecificBandwidth(sdp, connection.bandwidth, !!connection.session.screen);
            }

            if (connection.bandwidth.video) {
                sdp = CodecsHandler.setVideoBitrates(sdp, {
                    min: connection.bandwidth.video * 8 * 1024,
                    max: connection.bandwidth.video * 8 * 1024
                });
            }

            if (connection.bandwidth.audio) {
                sdp = CodecsHandler.setOpusAttributes(sdp, {
                    maxaveragebitrate: connection.bandwidth.audio * 8 * 1024,
                    maxplaybackrate: connection.bandwidth.audio * 8 * 1024,
                    stereo: 1,
                    maxptime: 3
                });
            }

            return sdp;
        };

        if (typeof CodecsHandler !== 'undefined') {
            connection.BandwidthHandler = connection.CodecsHandler = CodecsHandler;
        }

        connection.mediaConstraints = {
            audio: {
                mandatory: {},
                optional: connection.bandwidth.audio ? [{
                    bandwidth: connection.bandwidth.audio * 8 * 1024 || 128 * 8 * 1024
                }] : []
            },
            video: {
                mandatory: {},
                optional: connection.bandwidth.video ? [{
                    bandwidth: connection.bandwidth.video * 8 * 1024 || 128 * 8 * 1024
                }, {
                    facingMode: 'user'
                }] : [{
                    facingMode: 'user'
                }]
            }
        };

        if (DetectRTC.browser.name === 'Firefox') {
            connection.mediaConstraints = {
                audio: true,
                video: true
            };
        }

        if (!forceOptions.useDefaultDevices && !DetectRTC.isMobileDevice) {
            DetectRTC.load(function() {
                var lastAudioDevice, lastVideoDevice;
                // it will force RTCMultiConnection to capture last-devices
                // i.e. if external microphone is attached to system, we should prefer it over built-in devices.
                DetectRTC.MediaDevices.forEach(function(device) {
                    if (device.kind === 'audioinput' && connection.mediaConstraints.audio !== false) {
                        lastAudioDevice = device;
                    }

                    if (device.kind === 'videoinput' && connection.mediaConstraints.video !== false) {
                        lastVideoDevice = device;
                    }
                });

                if (lastAudioDevice) {
                    if (DetectRTC.browser.name === 'Firefox') {
                        if (connection.mediaConstraints.audio !== true) {
                            connection.mediaConstraints.audio.deviceId = lastAudioDevice.id;
                        } else {
                            connection.mediaConstraints.audio = {
                                deviceId: lastAudioDevice.id
                            }
                        }
                        return;
                    }

                    if (connection.mediaConstraints.audio == true) {
                        connection.mediaConstraints.audio = {
                            mandatory: {},
                            optional: []
                        }
                    }

                    if (!connection.mediaConstraints.audio.optional) {
                        connection.mediaConstraints.audio.optional = [];
                    }

                    var optional = [{
                        sourceId: lastAudioDevice.id
                    }];

                    connection.mediaConstraints.audio.optional = optional.concat(connection.mediaConstraints.audio.optional);
                }

                if (lastVideoDevice) {
                    if (DetectRTC.browser.name === 'Firefox') {
                        if (connection.mediaConstraints.video !== true) {
                            connection.mediaConstraints.video.deviceId = lastVideoDevice.id;
                        } else {
                            connection.mediaConstraints.video = {
                                deviceId: lastVideoDevice.id
                            }
                        }
                        return;
                    }

                    if (connection.mediaConstraints.video == true) {
                        connection.mediaConstraints.video = {
                            mandatory: {},
                            optional: []
                        }
                    }

                    if (!connection.mediaConstraints.video.optional) {
                        connection.mediaConstraints.video.optional = [];
                    }

                    var optional = [{
                        sourceId: lastVideoDevice.id
                    }];

                    connection.mediaConstraints.video.optional = optional.concat(connection.mediaConstraints.video.optional);
                }
            });
        }

        connection.sdpConstraints = {
            mandatory: {
                OfferToReceiveAudio: true,
                OfferToReceiveVideo: true
            },
            optional: [{
                VoiceActivityDetection: false
            }]
        };

        connection.sdpSemantics = null; // "unified-plan" or "plan-b", ref: webrtc.org/web-apis/chrome/unified-plan/
        connection.iceCandidatePoolSize = null; // 0
        connection.bundlePolicy = null; // max-bundle
        connection.rtcpMuxPolicy = null; // "require" or "negotiate"
        connection.iceTransportPolicy = null; // "relay" or "all"
        connection.optionalArgument = {
            optional: [{
                DtlsSrtpKeyAgreement: true
            }, {
                googImprovedWifiBwe: true
            }, {
                googScreencastMinBitrate: 300
            }, {
                googIPv6: true
            }, {
                googDscp: true
            }, {
                googCpuUnderuseThreshold: 55
            }, {
                googCpuOveruseThreshold: 85
            }, {
                googSuspendBelowMinBitrate: true
            }, {
                googCpuOveruseDetection: true
            }],
            mandatory: {}
        };

        connection.iceServers = IceServersHandler.getIceServers(connection);

        connection.candidates = {
            host: true,
            stun: true,
            turn: true
        };

        connection.iceProtocols = {
            tcp: true,
            udp: true
        };

        // EVENTs
        connection.onopen = function(event) {
            if (!!connection.enableLogs) {
                console.info('Data connection has been opened between you & ', event.userid);
            }
        };

        connection.onclose = function(event) {
            if (!!connection.enableLogs) {
                console.warn('Data connection has been closed between you & ', event.userid);
            }
        };

        connection.onerror = function(error) {
            if (!!connection.enableLogs) {
                console.error(error.userid, 'data-error', error);
            }
        };

        connection.onmessage = function(event) {
            if (!!connection.enableLogs) {
                console.debug('data-message', event.userid, event.data);
            }
        };

        connection.send = function(data, remoteUserId) {
            connection.peers.send(data, remoteUserId);
        };

        connection.close = connection.disconnect = connection.leave = function() {
            connection.onbeforeunload(false, true);
        };

        connection.closeEntireSession = function(callback) {
            callback = callback || function() {};
            connection.socket.emit('close-entire-session', function looper() {
                if (connection.getAllParticipants().length) {
                    setTimeout(looper, 100);
                    return;
                }

                connection.onEntireSessionClosed({
                    sessionid: connection.sessionid,
                    userid: connection.userid,
                    extra: connection.extra
                });

                connection.changeUserId(null, function() {
                    connection.close();
                    callback();
                });
            });
        };

        connection.onEntireSessionClosed = function(event) {
            if (!connection.enableLogs) return;
            console.info('Entire session is closed: ', event.sessionid, event.extra);
        };

        connection.onstream = function(e) {
            var parentNode = connection.videosContainer;
            parentNode.insertBefore(e.mediaElement, parentNode.firstChild);
            var played = e.mediaElement.play();

            if (typeof played !== 'undefined') {
                played.catch(function() {
                    /*** iOS 11 doesn't allow automatic play and rejects ***/
                }).then(function() {
                    setTimeout(function() {
                        e.mediaElement.play();
                    }, 2000);
                });
                return;
            }

            setTimeout(function() {
                e.mediaElement.play();
            }, 2000);
        };

        connection.onstreamended = function(e) {
            if (!e.mediaElement) {
                e.mediaElement = document.getElementById(e.streamid);
            }

            if (!e.mediaElement || !e.mediaElement.parentNode) {
                return;
            }

            e.mediaElement.parentNode.removeChild(e.mediaElement);
        };

        connection.direction = 'many-to-many';

        connection.removeStream = function(streamid, remoteUserId) {
            var stream;
            connection.attachStreams.forEach(function(localStream) {
                if (localStream.id === streamid) {
                    stream = localStream;
                }
            });

            if (!stream) {
                console.warn('No such stream exist.', streamid);
                return;
            }

            connection.peers.getAllParticipants().forEach(function(participant) {
                if (remoteUserId && participant !== remoteUserId) {
                    return;
                }

                var user = connection.peers[participant];
                try {
                    user.peer.removeStream(stream);
                } catch (e) {}
            });

            connection.renegotiate();
        };

        connection.addStream = function(session, remoteUserId) {
            if (!!session.getTracks) {
                if (connection.attachStreams.indexOf(session) === -1) {
                    if (!session.streamid) {
                        session.streamid = session.id;
                    }

                    connection.attachStreams.push(session);
                }
                connection.renegotiate(remoteUserId);
                return;
            }

            if (isData(session)) {
                connection.renegotiate(remoteUserId);
                return;
            }

            if (session.audio || session.video || session.screen) {
                if (session.screen) {
                    if (DetectRTC.browser.name === 'Edge') {
                        navigator.getDisplayMedia({
                            video: true,
                            audio: isAudioPlusTab(connection)
                        }).then(function(screen) {
                            screen.isScreen = true;
                            mPeer.onGettingLocalMedia(screen);

                            if ((session.audio || session.video) && !isAudioPlusTab(connection)) {
                                connection.invokeGetUserMedia(null, function(stream) {
                                    gumCallback(stream);
                                });
                            } else {
                                gumCallback(screen);
                            }
                        }, function(error) {
                            console.error('Unable to capture screen on Edge. HTTPs and version 17+ is required.');
                        });
                    } else {
                        connection.invokeGetUserMedia({
                            audio: isAudioPlusTab(connection),
                            video: true,
                            isScreen: true
                        }, function(stream) {
                            if ((session.audio || session.video) && !isAudioPlusTab(connection)) {
                                connection.invokeGetUserMedia(null, function(stream) {
                                    gumCallback(stream);
                                });
                            } else {
                                gumCallback(stream);
                            }
                        });
                    }
                } else if (session.audio || session.video) {
                    connection.invokeGetUserMedia(null, gumCallback);
                }
            }

            function gumCallback(stream) {
                if (session.streamCallback) {
                    session.streamCallback(stream);
                }

                connection.renegotiate(remoteUserId);
            }
        };

        connection.invokeGetUserMedia = function(localMediaConstraints, callback, session) {
            if (!session) {
                session = connection.session;
            }

            if (!localMediaConstraints) {
                localMediaConstraints = connection.mediaConstraints;
            }

            getUserMediaHandler({
                onGettingLocalMedia: function(stream) {
                    var videoConstraints = localMediaConstraints.video;
                    if (videoConstraints) {
                        if (videoConstraints.mediaSource || videoConstraints.mozMediaSource) {
                            stream.isScreen = true;
                        } else if (videoConstraints.mandatory && videoConstraints.mandatory.chromeMediaSource) {
                            stream.isScreen = true;
                        }
                    }

                    if (!stream.isScreen) {
                        stream.isVideo = !!getTracks(stream, 'video').length;
                        stream.isAudio = !stream.isVideo && getTracks(stream, 'audio').length;
                    }

                    mPeer.onGettingLocalMedia(stream, function() {
                        if (typeof callback === 'function') {
                            callback(stream);
                        }
                    });
                },
                onLocalMediaError: function(error, constraints) {
                    mPeer.onLocalMediaError(error, constraints);
                },
                localMediaConstraints: localMediaConstraints || {
                    audio: session.audio ? localMediaConstraints.audio : false,
                    video: session.video ? localMediaConstraints.video : false
                }
            });
        };

        function applyConstraints(stream, mediaConstraints) {
            if (!stream) {
                if (!!connection.enableLogs) {
                    console.error('No stream to applyConstraints.');
                }
                return;
            }

            if (mediaConstraints.audio) {
                getTracks(stream, 'audio').forEach(function(track) {
                    track.applyConstraints(mediaConstraints.audio);
                });
            }

            if (mediaConstraints.video) {
                getTracks(stream, 'video').forEach(function(track) {
                    track.applyConstraints(mediaConstraints.video);
                });
            }
        }

        connection.applyConstraints = function(mediaConstraints, streamid) {
            if (!MediaStreamTrack || !MediaStreamTrack.prototype.applyConstraints) {
                alert('track.applyConstraints is NOT supported in your browser.');
                return;
            }

            if (streamid) {
                var stream;
                if (connection.streamEvents[streamid]) {
                    stream = connection.streamEvents[streamid].stream;
                }
                applyConstraints(stream, mediaConstraints);
                return;
            }

            connection.attachStreams.forEach(function(stream) {
                applyConstraints(stream, mediaConstraints);
            });
        };

        function replaceTrack(track, remoteUserId, isVideoTrack) {
            if (remoteUserId) {
                mPeer.replaceTrack(track, remoteUserId, isVideoTrack);
                return;
            }

            connection.peers.getAllParticipants().forEach(function(participant) {
                mPeer.replaceTrack(track, participant, isVideoTrack);
            });
        }

        connection.replaceTrack = function(session, remoteUserId, isVideoTrack) {
            session = session || {};

            if (!RTCPeerConnection.prototype.getSenders) {
                connection.addStream(session);
                return;
            }

            if (session instanceof MediaStreamTrack) {
                replaceTrack(session, remoteUserId, isVideoTrack);
                return;
            }

            if (session instanceof MediaStream) {
                if (getTracks(session, 'video').length) {
                    replaceTrack(getTracks(session, 'video')[0], remoteUserId, true);
                }

                if (getTracks(session, 'audio').length) {
                    replaceTrack(getTracks(session, 'audio')[0], remoteUserId, false);
                }
                return;
            }

            if (isData(session)) {
                throw 'connection.replaceTrack requires audio and/or video and/or screen.';
                return;
            }

            if (session.audio || session.video || session.screen) {
                if (session.screen) {
                    if (DetectRTC.browser.name === 'Edge') {
                        navigator.getDisplayMedia({
                            video: true,
                            audio: isAudioPlusTab(connection)
                        }).then(function(screen) {
                            screen.isScreen = true;
                            mPeer.onGettingLocalMedia(screen);

                            if ((session.audio || session.video) && !isAudioPlusTab(connection)) {
                                connection.invokeGetUserMedia(null, gumCallback);
                            } else {
                                gumCallback(screen);
                            }
                        }, function(error) {
                            console.error('Unable to capture screen on Edge. HTTPs and version 17+ is required.');
                        });
                    } else {
                        connection.invokeGetUserMedia({
                            audio: isAudioPlusTab(connection),
                            video: true,
                            isScreen: true
                        }, (session.audio || session.video) && !isAudioPlusTab(connection) ? connection.invokeGetUserMedia(null, gumCallback) : gumCallback);
                    }
                } else if (session.audio || session.video) {
                    connection.invokeGetUserMedia(null, gumCallback);
                }
            }

            function gumCallback(stream) {
                connection.replaceTrack(stream, remoteUserId, isVideoTrack || session.video || session.screen);
            }
        };

        connection.resetTrack = function(remoteUsersIds, isVideoTrack) {
            if (!remoteUsersIds) {
                remoteUsersIds = connection.getAllParticipants();
            }

            if (typeof remoteUsersIds == 'string') {
                remoteUsersIds = [remoteUsersIds];
            }

            remoteUsersIds.forEach(function(participant) {
                var peer = connection.peers[participant].peer;

                if ((typeof isVideoTrack === 'undefined' || isVideoTrack === true) && peer.lastVideoTrack) {
                    connection.replaceTrack(peer.lastVideoTrack, participant, true);
                }

                if ((typeof isVideoTrack === 'undefined' || isVideoTrack === false) && peer.lastAudioTrack) {
                    connection.replaceTrack(peer.lastAudioTrack, participant, false);
                }
            });
        };

        connection.renegotiate = function(remoteUserId) {
            if (remoteUserId) {
                mPeer.renegotiatePeer(remoteUserId);
                return;
            }

            connection.peers.getAllParticipants().forEach(function(participant) {
                mPeer.renegotiatePeer(participant);
            });
        };

        connection.setStreamEndHandler = function(stream, isRemote) {
            if (!stream || !stream.addEventListener) return;

            isRemote = !!isRemote;

            if (stream.alreadySetEndHandler) {
                return;
            }
            stream.alreadySetEndHandler = true;

            var streamEndedEvent = 'ended';

            if ('oninactive' in stream) {
                streamEndedEvent = 'inactive';
            }

            stream.addEventListener(streamEndedEvent, function() {
                if (stream.idInstance) {
                    currentUserMediaRequest.remove(stream.idInstance);
                }

                if (!isRemote) {
                    // reset attachStreams
                    var streams = [];
                    connection.attachStreams.forEach(function(s) {
                        if (s.id != stream.id) {
                            streams.push(s);
                        }
                    });
                    connection.attachStreams = streams;
                }

                // connection.renegotiate();

                var streamEvent = connection.streamEvents[stream.streamid];
                if (!streamEvent) {
                    streamEvent = {
                        stream: stream,
                        streamid: stream.streamid,
                        type: isRemote ? 'remote' : 'local',
                        userid: connection.userid,
                        extra: connection.extra,
                        mediaElement: connection.streamEvents[stream.streamid] ? connection.streamEvents[stream.streamid].mediaElement : null
                    };
                }

                if (isRemote && connection.peers[streamEvent.userid]) {
                    // reset remote "streams"
                    var peer = connection.peers[streamEvent.userid].peer;
                    var streams = [];
                    peer.getRemoteStreams().forEach(function(s) {
                        if (s.id != stream.id) {
                            streams.push(s);
                        }
                    });
                    connection.peers[streamEvent.userid].streams = streams;
                }

                if (streamEvent.userid === connection.userid && streamEvent.type === 'remote') {
                    return;
                }

                if (connection.peersBackup[streamEvent.userid]) {
                    streamEvent.extra = connection.peersBackup[streamEvent.userid].extra;
                }

                connection.onstreamended(streamEvent);

                delete connection.streamEvents[stream.streamid];
            }, false);
        };

        connection.onMediaError = function(error, constraints) {
            if (!!connection.enableLogs) {
                console.error(error, constraints);
            }
        };

        connection.autoCloseEntireSession = false;

        connection.filesContainer = connection.videosContainer = document.body || document.documentElement;
        connection.isInitiator = false;

        connection.shareFile = mPeer.shareFile;
        if (typeof FileProgressBarHandler !== 'undefined') {
            FileProgressBarHandler.handle(connection);
        }

        if (typeof TranslationHandler !== 'undefined') {
            TranslationHandler.handle(connection);
        }

        connection.token = getRandomString;

        connection.onNewParticipant = function(participantId, userPreferences) {
            connection.acceptParticipationRequest(participantId, userPreferences);
        };

        connection.acceptParticipationRequest = function(participantId, userPreferences) {
            if (userPreferences.successCallback) {
                userPreferences.successCallback();
                delete userPreferences.successCallback;
            }

            mPeer.createNewPeer(participantId, userPreferences);
        };

        if (typeof StreamsHandler !== 'undefined') {
            connection.StreamsHandler = StreamsHandler;
        }

        connection.onleave = function(userid) {};

        connection.invokeSelectFileDialog = function(callback) {
            var selector = new FileSelector();
            selector.accept = '*.*';
            selector.selectSingleFile(callback);
        };

        connection.onmute = function(e) {
            if (!e || !e.mediaElement) {
                return;
            }

            if (e.muteType === 'both' || e.muteType === 'video') {
                e.mediaElement.src = null;
                var paused = e.mediaElement.pause();
                if (typeof paused !== 'undefined') {
                    paused.then(function() {
                        e.mediaElement.poster = e.snapshot || 'https://cdn.webrtc-experiment.com/images/muted.png';
                    });
                } else {
                    e.mediaElement.poster = e.snapshot || 'https://cdn.webrtc-experiment.com/images/muted.png';
                }
            } else if (e.muteType === 'audio') {
                e.mediaElement.muted = true;
            }
        };

        connection.onunmute = function(e) {
            if (!e || !e.mediaElement || !e.stream) {
                return;
            }

            if (e.unmuteType === 'both' || e.unmuteType === 'video') {
                e.mediaElement.poster = null;
                e.mediaElement.srcObject = e.stream;
                e.mediaElement.play();
            } else if (e.unmuteType === 'audio') {
                e.mediaElement.muted = false;
            }
        };

        connection.onExtraDataUpdated = function(event) {
            event.status = 'online';
            connection.onUserStatusChanged(event, true);
        };

        connection.getAllParticipants = function(sender) {
            return connection.peers.getAllParticipants(sender);
        };

        if (typeof StreamsHandler !== 'undefined') {
            StreamsHandler.onSyncNeeded = function(streamid, action, type) {
                connection.peers.getAllParticipants().forEach(function(participant) {
                    mPeer.onNegotiationNeeded({
                        streamid: streamid,
                        action: action,
                        streamSyncNeeded: true,
                        type: type || 'both'
                    }, participant);
                });
            };
        }

        connection.connectSocket = function(callback) {
            connectSocket(callback);
        };

        connection.closeSocket = function() {
            try {
                io.sockets = {};
            } catch (e) {};

            if (!connection.socket) return;

            if (typeof connection.socket.disconnect === 'function') {
                connection.socket.disconnect();
            }

            if (typeof connection.socket.resetProps === 'function') {
                connection.socket.resetProps();
            }

            connection.socket = null;
        };

        connection.getSocket = function(callback) {
            if (!callback && connection.enableLogs) {
                console.warn('getSocket.callback paramter is required.');
            }

            callback = callback || function() {};

            if (!connection.socket) {
                connectSocket(function() {
                    callback(connection.socket);
                });
            } else {
                callback(connection.socket);
            }

            return connection.socket; // callback is preferred over return-statement
        };

        connection.getRemoteStreams = mPeer.getRemoteStreams;

        var skipStreams = ['selectFirst', 'selectAll', 'forEach'];

        connection.streamEvents = {
            selectFirst: function(options) {
                return connection.streamEvents.selectAll(options)[0];
            },
            selectAll: function(options) {
                if (!options) {
                    // default will always be all streams
                    options = {
                        local: true,
                        remote: true,
                        isScreen: true,
                        isAudio: true,
                        isVideo: true
                    };
                }

                if (options == 'local') {
                    options = {
                        local: true
                    };
                }

                if (options == 'remote') {
                    options = {
                        remote: true
                    };
                }

                if (options == 'screen') {
                    options = {
                        isScreen: true
                    };
                }

                if (options == 'audio') {
                    options = {
                        isAudio: true
                    };
                }

                if (options == 'video') {
                    options = {
                        isVideo: true
                    };
                }

                var streams = [];
                Object.keys(connection.streamEvents).forEach(function(key) {
                    var event = connection.streamEvents[key];

                    if (skipStreams.indexOf(key) !== -1) return;
                    var ignore = true;

                    if (options.local && event.type === 'local') {
                        ignore = false;
                    }

                    if (options.remote && event.type === 'remote') {
                        ignore = false;
                    }

                    if (options.isScreen && event.stream.isScreen) {
                        ignore = false;
                    }

                    if (options.isVideo && event.stream.isVideo) {
                        ignore = false;
                    }

                    if (options.isAudio && event.stream.isAudio) {
                        ignore = false;
                    }

                    if (options.userid && event.userid === options.userid) {
                        ignore = false;
                    }

                    if (ignore === false) {
                        streams.push(event);
                    }
                });

                return streams;
            }
        };

        connection.socketURL = '/'; // generated via config.json
        connection.socketMessageEvent = 'MUVR-Message'; // generated via config.json
        connection.socketCustomEvent = 'MUVR-Message-Custom'; // generated via config.json
        connection.DetectRTC = DetectRTC;

        connection.setCustomSocketEvent = function(customEvent) {
            if (customEvent) {
                connection.socketCustomEvent = customEvent;
            }

            if (!connection.socket) {
                return;
            }

            connection.socket.emit('set-custom-socket-event-listener', connection.socketCustomEvent);
        };

        connection.getNumberOfBroadcastViewers = function(broadcastId, callback) {
            if (!connection.socket || !broadcastId || !callback) return;

            connection.socket.emit('get-number-of-users-in-specific-broadcast', broadcastId, callback);
        };

        connection.onNumberOfBroadcastViewersUpdated = function(event) {
            if (!connection.enableLogs || !connection.isInitiator) return;
            console.info('Number of broadcast (', event.broadcastId, ') viewers', event.numberOfBroadcastViewers);
        };

        connection.onUserStatusChanged = function(event, dontWriteLogs) {
            if (!!connection.enableLogs && !dontWriteLogs) {
                console.info(event.userid, event.status);
            }
        };

        connection.getUserMediaHandler = getUserMediaHandler;
        connection.multiPeersHandler = mPeer;
        connection.enableLogs = true;
        connection.setCustomSocketHandler = function(customSocketHandler) {
            if (typeof SocketConnection !== 'undefined') {
                SocketConnection = customSocketHandler;
            }
        };

        // default value should be 15k because [old]Firefox's receiving limit is 16k!
        // however 64k works chrome-to-chrome
        connection.chunkSize = 40 * 1000;

        connection.maxParticipantsAllowed = 1000;

        // eject or leave single user
        connection.disconnectWith = mPeer.disconnectWith;

        // check if room exist on server
        // we will pass roomid to the server and wait for callback (i.e. server's response)
        connection.checkPresence = function(roomid, callback) {
            roomid = roomid || connection.sessionid;

            if (SocketConnection.name === 'SSEConnection') {
                SSEConnection.checkPresence(roomid, function(isRoomExist, _roomid, extra) {
                    if (!connection.socket) {
                        if (!isRoomExist) {
                            connection.userid = _roomid;
                        }

                        connection.connectSocket(function() {
                            callback(isRoomExist, _roomid, extra);
                        });
                        return;
                    }
                    callback(isRoomExist, _roomid);
                });
                return;
            }

            if (!connection.socket) {
                connection.connectSocket(function() {
                    connection.checkPresence(roomid, callback);
                });
                return;
            }

            connection.socket.emit('check-presence', roomid + '', function(isRoomExist, _roomid, extra) {
                if (connection.enableLogs) {
                    console.log('checkPresence.isRoomExist: ', isRoomExist, ' roomid: ', _roomid);
                }
                callback(isRoomExist, _roomid, extra);
            });
        };

        connection.onReadyForOffer = function(remoteUserId, userPreferences) {
            connection.multiPeersHandler.createNewPeer(remoteUserId, userPreferences);
        };

        connection.setUserPreferences = function(userPreferences) {
            if (connection.dontAttachStream) {
                userPreferences.dontAttachLocalStream = true;
            }

            if (connection.dontGetRemoteStream) {
                userPreferences.dontGetRemoteStream = true;
            }

            return userPreferences;
        };

        connection.updateExtraData = function() {
            connection.socket.emit('extra-data-updated', connection.extra);
        };

        connection.enableScalableBroadcast = false;
        connection.maxRelayLimitPerUser = 3; // each broadcast should serve only 3 users

        connection.dontCaptureUserMedia = false;
        connection.dontAttachStream = false;
        connection.dontGetRemoteStream = false;

        connection.onReConnecting = function(event) {
            if (connection.enableLogs) {
                console.info('ReConnecting with', event.userid, '...');
            }
        };

        connection.beforeAddingStream = function(stream) {
            return stream;
        };

        connection.beforeRemovingStream = function(stream) {
            return stream;
        };

        if (typeof isChromeExtensionAvailable !== 'undefined') {
            connection.checkIfChromeExtensionAvailable = isChromeExtensionAvailable;
        }

        if (typeof isFirefoxExtensionAvailable !== 'undefined') {
            connection.checkIfChromeExtensionAvailable = isFirefoxExtensionAvailable;
        }

        if (typeof getChromeExtensionStatus !== 'undefined') {
            connection.getChromeExtensionStatus = getChromeExtensionStatus;
        }

        connection.modifyScreenConstraints = function(screen_constraints) {
            return screen_constraints;
        };

        connection.onPeerStateChanged = function(state) {
            if (connection.enableLogs) {
                if (state.iceConnectionState.search(/closed|failed/gi) !== -1) {
                    console.error('Peer connection is closed between you & ', state.userid, state.extra, 'state:', state.iceConnectionState);
                }
            }
        };

        connection.isOnline = true;

        listenEventHandler('online', function() {
            connection.isOnline = true;
        });

        listenEventHandler('offline', function() {
            connection.isOnline = false;
        });

        connection.isLowBandwidth = false;
        if (navigator && navigator.connection && navigator.connection.type) {
            connection.isLowBandwidth = navigator.connection.type.toString().toLowerCase().search(/wifi|cell/g) !== -1;
            if (connection.isLowBandwidth) {
                connection.bandwidth = {
                    audio: false,
                    video: false,
                    screen: false
                };

                if (connection.mediaConstraints.audio && connection.mediaConstraints.audio.optional && connection.mediaConstraints.audio.optional.length) {
                    var newArray = [];
                    connection.mediaConstraints.audio.optional.forEach(function(opt) {
                        if (typeof opt.bandwidth === 'undefined') {
                            newArray.push(opt);
                        }
                    });
                    connection.mediaConstraints.audio.optional = newArray;
                }

                if (connection.mediaConstraints.video && connection.mediaConstraints.video.optional && connection.mediaConstraints.video.optional.length) {
                    var newArray = [];
                    connection.mediaConstraints.video.optional.forEach(function(opt) {
                        if (typeof opt.bandwidth === 'undefined') {
                            newArray.push(opt);
                        }
                    });
                    connection.mediaConstraints.video.optional = newArray;
                }
            }
        }

        connection.getExtraData = function(remoteUserId, callback) {
            if (!remoteUserId) throw 'remoteUserId is required.';

            if (typeof callback === 'function') {
                connection.socket.emit('get-remote-user-extra-data', remoteUserId, function(extra, remoteUserId, error) {
                    callback(extra, remoteUserId, error);
                });
                return;
            }

            if (!connection.peers[remoteUserId]) {
                if (connection.peersBackup[remoteUserId]) {
                    return connection.peersBackup[remoteUserId].extra;
                }
                return {};
            }

            return connection.peers[remoteUserId].extra;
        };

        if (!!forceOptions.autoOpenOrJoin) {
            connection.openOrJoin(connection.sessionid);
        }

        connection.onUserIdAlreadyTaken = function(useridAlreadyTaken, yourNewUserId) {
            // via #683
            connection.close();
            connection.closeSocket();

            connection.isInitiator = false;
            connection.userid = connection.token();

            connection.join(connection.sessionid);

            if (connection.enableLogs) {
                console.warn('Userid already taken.', useridAlreadyTaken, 'Your new userid:', connection.userid);
            }
        };

        connection.trickleIce = true;
        connection.version = '3.7.0';

        connection.onSettingLocalDescription = function(event) {
            if (connection.enableLogs) {
                console.info('Set local description for remote user', event.userid);
            }
        };

        connection.resetScreen = function() {
            sourceId = null;
            if (DetectRTC && DetectRTC.screen) {
                delete DetectRTC.screen.sourceId;
            }

            currentUserMediaRequest = {
                streams: [],
                mutex: false,
                queueRequests: []
            };
        };

        // if disabled, "event.mediaElement" for "onstream" will be NULL
        connection.autoCreateMediaElement = true;

        // set password
        connection.password = null;

        // set password
        connection.setPassword = function(password, callback) {
            callback = callback || function() {};
            if (connection.socket) {
                connection.socket.emit('set-password', password, callback);
            } else {
                connection.password = password;
                callback(true, connection.sessionid, null);
            }
        };

        connection.onSocketDisconnect = function(event) {
            if (connection.enableLogs) {
                console.warn('socket.io connection is closed');
            }
        };

        connection.onSocketError = function(event) {
            if (connection.enableLogs) {
                console.warn('socket.io connection is failed');
            }
        };

        // error messages
        connection.errors = {
            ROOM_NOT_AVAILABLE: 'Room not available',
            INVALID_PASSWORD: 'Invalid password',
            USERID_NOT_AVAILABLE: 'User ID does not exist',
            ROOM_PERMISSION_DENIED: 'Room permission denied',
            ROOM_FULL: 'Room full',
            DID_NOT_JOIN_ANY_ROOM: 'Did not join any room yet',
            INVALID_SOCKET: 'Invalid socket',
            PUBLIC_IDENTIFIER_MISSING: 'publicRoomIdentifier is required',
            INVALID_ADMIN_CREDENTIAL: 'Invalid username or password attempted'
        };
    })(this);

};

if (typeof module !== 'undefined' /* && !!module.exports*/ ) {
    module.exports = exports = RTCMultiConnection;
}

if (typeof define === 'function' && define.amd) {
    define('RTCMultiConnection', [], function() {
        return RTCMultiConnection;
    });
}
