class Block {
    index: number = 0;
    previousHash: string = '';
    timestamp: number = 0;
    data: any;
    hash: string = '';

    constructor(
        index: number,
        previousHash: string,
        timestamp: number,
        data: any,
        hash: string
    ) {
        this.index = index;
        this.previousHash = previousHash;
        this.timestamp = timestamp;
        this.data = data;
        this.hash = hash;
    }
}

export default Block;
