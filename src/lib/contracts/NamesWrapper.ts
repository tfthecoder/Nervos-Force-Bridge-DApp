import Web3 from 'web3';
import * as NamesJSON from '../../../build/contracts/Names.json';
import { Names } from '../../types/Names';

const DEFAULT_SEND_OPTIONS = {
    gas: 6000000
};

export class NamesWrapper {
    web3: Web3;

    contract: Names;

    address: string;

    constructor(web3: Web3) {
        this.web3 = web3;
        this.contract = new web3.eth.Contract(NamesJSON.abi as any) as any;
    }

    get isDeployed() {
        return Boolean(this.address);
    }

    async getName(id: number, fromAddress: string) {
        const data = await this.contract.methods.names(id).call({ from: fromAddress });

        return data;
    }

    async createName(name: string, fromAddress: string) {
        const tx = await this.contract.methods.addName(name).send({
            ...DEFAULT_SEND_OPTIONS,
            from: fromAddress
        });

        return tx;
    }

    async getTotalName(fromAddress: string) {
        const data = await this.contract.methods.totalName().call({ from: fromAddress });

        return parseInt(data, 10);
    }

    async deploy(fromAddress: string) {
        const tx = this.contract
            .deploy({
                data: NamesJSON.bytecode,
                arguments: []
            })
            .send({
                ...DEFAULT_SEND_OPTIONS,
                from: fromAddress
            });

        let transactionHash: string = null;
        tx.on('transactionHash', (hash: string) => {
            transactionHash = hash;
        });

        const contract = await tx;

        this.useDeployed(contract.options.address);

        return transactionHash;
    }

    useDeployed(contractAddress: string) {
        this.address = contractAddress;
        this.contract.options.address = contractAddress;
    }
}
