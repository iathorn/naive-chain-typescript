import './lib/env';
import CryptoJS from 'crypto-js';
import express from 'express';
import bodyParser from 'body-parser';
import WebSocket from 'ws';
import Block from './models/Block';

const { HTTP_PORT: httpPort = 3001, P2P_PORT: p2pPort = 6001 } = process.env;
const initialPeers = process.env.PEERS ? process.env.PEERS.split(',') : [];

const sockets: any[] = [];

const MessageType = {
    QUERY_LATEST: 0,
    QUERY_ALL: 1,
    RESPONSE_BLOCKCHAIN: 2,
};

const getGenesisBlock = () => {
    return new Block(
        0,
        '0',
        1465154705,
        'my genesis block!!',
        '816534932c2b7154836da6afc367695e6337db8a921823784c14378abed4f7d7'
    );
};

const blockchain = [getGenesisBlock()];

const initHttpServer = () => {
    const app = express();
    app.use(bodyParser.json());

    app.get('/blocks', (req, res) => res.status(200).json(blockchain));
    app.post('/mineBlock', (req, res) => {
        const newBlock = generateNextBlock();
        addBlock(newBlock);
        broadcast(responseLatestMsg());
        console.log(`block added: ${JSON.stringify(newBlock)}`);
        res.status(200).json({
            success: true,
        });
    });
    app.get('/peers', (req, res) => {
        res.status(200).json(
            sockets.map(
                s => `${s._socket.remoteAddress} ${s._socket.remotePort}`
            )
        );
    });
    app.post('/addPeer', (req, res) => {
        connectToPeers([req.body.peer]);
        res.status(200).json({
            success: true,
        });
    });
    app.listen(httpPort, () =>
        console.log(`Listening http on port: ${httpPort}`)
    );
};

const initP2PServer = () => {
    if (!p2pPort) return;
    const server = new WebSocket.Server({ port: +p2pPort });
    server.on('connection', (ws: WebSocket) => initConnection(ws));
    console.log(`listening websocket p2p port on: ${p2pPort}`);
};

const generateNextBlock = (blockData?: any) => {
    const previousBlock = getLatestBlock();
    const nextIndex = previousBlock.index + 1;
    const nextTimestamp = new Date().getTime() / 1000;
    const nextHash = calculateHash(
        nextIndex,
        previousBlock.hash,
        nextTimestamp,
        blockData
    );
    return new Block(
        nextIndex,
        previousBlock.hash,
        nextTimestamp,
        blockData,
        nextHash
    );
};

const initMessageHandler = (webSocket: WebSocket) => {
    webSocket.on('message', (data: any) => {
        const message = JSON.parse(data);
        console.log(`Received message ${JSON.stringify(message)}`);
        switch (message.type) {
            case MessageType.QUERY_LATEST:
                write(webSocket, responseLatestMsg());
                break;
            case MessageType.QUERY_ALL:
                write(webSocket, responseChainMsg());
                break;
            case MessageType.RESPONSE_BLOCKCHAIN:
                handleBlockchainResponse(message);
                break;
        }
    });
};

const initErrorHandler = (webSocket: WebSocket) => {
    const closeConnection = (ws: WebSocket) => {
        console.log(`connection failed to peer: ${ws.url}`);
        sockets.splice(sockets.indexOf(ws), 1);
    };
    webSocket.on('close', () => closeConnection(webSocket));
    webSocket.on('error', () => closeConnection(webSocket));
};

const initConnection = (webSocket: WebSocket) => {
    sockets.push(webSocket);
    initMessageHandler(webSocket);
    initErrorHandler(webSocket);
};

const connectToPeers = (newPeers: any[]) => {
    newPeers.forEach(peer => {
        const ws = new WebSocket(peer);
        ws.on('open', () => initConnection(ws));
    });
};

const getLatestBlock = () => blockchain[blockchain.length - 1];
const calculateHash = (
    index: number,
    previousHash: string,
    timestamp: number,
    data: any
) => {
    const hashPayload = index + previousHash + timestamp + data;
    return CryptoJS.SHA256(hashPayload).toString();
};
const addBlock = (newBlock: Block) => {
    if (isValidNewBlock(newBlock, getLatestBlock())) {
        blockchain.push(newBlock);
    }
};

const isValidNewBlock = (newBlock: Block, previousBlock: Block) => (
    newBlock: Block,
    previousBlock: Block
) => {
    if (previousBlock.index + 1 !== newBlock.index) {
        console.log('invalid index');
        return false;
    } else if (previousBlock.hash !== newBlock.previousHash) {
        console.log('invalid previoushash');
        return false;
    } else if (calculateHashForBlock(newBlock) !== newBlock.hash) {
        console.log(
            `${typeof newBlock.hash} ${typeof calculateHashForBlock(newBlock)}`
        );
        console.log(
            `invalid hash: ${calculateHashForBlock(newBlock)} ${newBlock.hash}`
        );
        return false;
    }
    return true;
};

const handleBlockchainResponse = (message: string) => {
    const receivedBlocks = JSON.parse(message).sort();
};

const calculateHashForBlock = (block: Block) =>
    calculateHash(block.index, block.previousHash, block.timestamp, block.data);

const responseChainMsg = () => ({
    type: MessageType.RESPONSE_BLOCKCHAIN,
    data: JSON.stringify(blockchain),
});
const responseLatestMsg = () => ({
    type: MessageType.RESPONSE_BLOCKCHAIN,
    data: JSON.stringify([getLatestBlock()]),
});
const write = (ws: WebSocket, message: WriteMessageType) =>
    ws.send(JSON.stringify(message));
const broadcast = (message: WriteMessageType) =>
    sockets.forEach(socket => write(socket, message));

type WriteMessageType = {
    type: number;
    data: string;
};

connectToPeers(initialPeers);
initHttpServer();
initP2PServer();
