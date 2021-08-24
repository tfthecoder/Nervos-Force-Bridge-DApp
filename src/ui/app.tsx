/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-use-before-define */
import React, { useEffect, useState } from 'react';
import Web3 from 'web3';
import { ToastContainer, toast } from 'react-toastify';
import './app.scss';
import 'react-toastify/dist/ReactToastify.css';
import { PolyjuiceHttpProvider } from '@polyjuice-provider/web3';
import { AddressTranslator } from 'nervos-godwoken-integration';
import * as CompiledContractArtifact from '../../build/contracts/ERC20.json';
import { NamesWrapper } from '../lib/contracts/NamesWrapper';
import { CONFIG } from '../config';
import {
    DEPLOYED_CKETH_ADDRESS,
    format,
    FORCE_BRIDGE_URL,
    SUDT_PROXY_CONTRACT_ADDRESS
} from './utils';

async function createWeb3() {
    // Modern dapp browsers...
    if ((window as any).ethereum) {
        const godwokenRpcUrl = CONFIG.WEB3_PROVIDER_URL;
        const providerConfig = {
            rollupTypeHash: CONFIG.ROLLUP_TYPE_HASH,
            ethAccountLockCodeHash: CONFIG.ETH_ACCOUNT_LOCK_CODE_HASH,
            web3Url: godwokenRpcUrl
        };

        const provider = new PolyjuiceHttpProvider(godwokenRpcUrl, providerConfig);
        const web3 = new Web3(provider || Web3.givenProvider);

        try {
            // Request account access if needed
            await (window as any).ethereum.enable();
        } catch (error) {
            // User denied account access...
        }

        return web3;
    }

    console.log('Non-Ethereum browser detected. You should consider trying MetaMask!');
    return null;
}

export function App() {
    const [web3, setWeb3] = useState<Web3>(null);
    const [contract, setContract] = useState<NamesWrapper>();
    const [accounts, setAccounts] = useState<string[]>();
    const [l2Balance, setL2Balance] = useState<bigint>();
    const [existingContractIdInputValue, setExistingContractIdInputValue] = useState<string>();
    const [deployTxHash, setDeployTxHash] = useState<string | undefined>();
    const [polyjuiceAddress, setPolyjuiceAddress] = useState<string | undefined>();
    const [transactionInProgress, setTransactionInProgress] = useState(false);
    const [names, setNames] = useState<{ id: number; name: string }[]>();
    const [loading, setLoading] = useState<boolean>(false);
    const [typedName, setTypedName] = useState<string>();
    const [layer2DepositAddress, setLayer2DepositAddress] = useState<string>();
    const [sudt, setSudt] = useState<number>();
    const [ckEth, setCketh] = useState<number>();

    const toastId = React.useRef(null);

    useEffect(() => {
        if (accounts?.[0]) {
            const addressTranslator = new AddressTranslator();
            setPolyjuiceAddress(addressTranslator.ethAddressToGodwokenShortAddress(accounts?.[0]));
        } else {
            setPolyjuiceAddress(undefined);
        }
    }, [accounts?.[0]]);

    useEffect(() => {
        if (transactionInProgress && !toastId.current) {
            toastId.current = toast.info(
                'Transaction in progress. Confirm MetaMask signing dialog and please wait...',
                {
                    position: 'top-right',
                    autoClose: false,
                    hideProgressBar: false,
                    closeOnClick: false,
                    pauseOnHover: true,
                    draggable: true,
                    progress: undefined,
                    closeButton: false
                }
            );
        } else if (!transactionInProgress && toastId.current) {
            toast.dismiss(toastId.current);
            toastId.current = null;
        }
    }, [transactionInProgress, toastId.current]);

    useEffect(() => {
        if (contract && accounts) {
            getAllNames();
        }
    }, [contract, accounts]);

    useEffect(() => {
        if (web3 && polyjuiceAddress && accounts) {
            getLayer2SudtAndCkethBalance();
        }
    }, [web3, polyjuiceAddress, accounts]);

    const account = accounts?.[0];

    async function getLayer2SudtAndCkethBalance() {
        const sudtContract = new web3.eth.Contract(
            CompiledContractArtifact.abi as any,
            SUDT_PROXY_CONTRACT_ADDRESS
        );

        const sudtBalance = Number(
            await sudtContract.methods.balanceOf(polyjuiceAddress).call({
                from: accounts?.[0]
            })
        );

        setSudt(sudtBalance);

        const ckethContract = new web3.eth.Contract(
            CompiledContractArtifact.abi as any,
            DEPLOYED_CKETH_ADDRESS
        );

        const ckEthBalance = Number(
            await ckethContract.methods.balanceOf(polyjuiceAddress).call({
                from: accounts?.[0]
            })
        );

        setCketh(ckEthBalance);
    }

    async function getLayer2DepositAddress() {
        const addressTranslator = new AddressTranslator();
        const depositAddress = await addressTranslator.getLayer2DepositAddress(web3, accounts?.[0]);
        setLayer2DepositAddress(depositAddress.addressString);
    }

    async function deployContract() {
        const _contract = new NamesWrapper(web3);

        try {
            setDeployTxHash(undefined);
            setTransactionInProgress(true);

            const transactionHash = await _contract.deploy(account);

            setDeployTxHash(transactionHash);
            setExistingContractAddress(_contract.address);
            toast(
                'Successfully deployed a smart-contract. You can now proceed to get or set the value in a smart contract.',
                { type: 'success' }
            );
        } catch (error) {
            console.error(error);
            toast.error(
                'There was an error sending your transaction. Please check developer console.'
            );
        } finally {
            setTransactionInProgress(false);
        }
    }

    async function getName(id: number) {
        const name = await contract.getName(id, account);
        // toast('Successfully read latest stored value.', { type: 'success' });
        return { id: Number(name.id), name: name.name };
    }

    async function getAllNames() {
        setLoading(true);
        const totalName = await contract.getTotalName(account);
        const nameList = [];
        for (let i = 1; i <= totalName; i++) {
            const newName = await getName(i);
            nameList.push(newName);
        }
        setNames(nameList);
        setLoading(false);
        toast('Successfully read all the names shared with Network 👷‍♂️', { type: 'success' });
    }

    async function setExistingContractAddress(contractAddress: string) {
        const _contract = new NamesWrapper(web3);
        _contract.useDeployed(contractAddress.trim());

        setContract(_contract);
    }

    async function createNewName() {
        if (!typedName) return;
        try {
            setTransactionInProgress(true);
            await contract.createName(typedName, account);
            toast('Successfully created new name 📚', { type: 'success' });
            await getAllNames();
        } catch (error) {
            console.error(error);
            toast.error(
                'There was an error sending your transaction. Please check developer console.'
            );
        } finally {
            setTransactionInProgress(false);
        }
    }

    useEffect(() => {
        if (web3) {
            return;
        }

        (async () => {
            const _web3 = await createWeb3();
            setWeb3(_web3);

            const _accounts = [(window as any).ethereum.selectedAddress];
            setAccounts(_accounts);
            console.log({ _accounts });

            if (_accounts && _accounts[0]) {
                const _l2Balance = BigInt(await _web3.eth.getBalance(_accounts[0]));
                setL2Balance(_l2Balance);
            }
        })();
    });

    const LoadingIndicator = () => <span className="rotating-icon">⚙️</span>;

    return (
        <div style={{ marginRight: '%40' }}>
            <h1>Name Storage & Listing DApp</h1>
            <br />
            <br />
            Previously deployed contract address: <b>0xbEB3E1A1c443e2c740155988185A532B100a5a7b</b>
            <br />
            <br />
            Your ETH address: <b>{accounts?.[0]}</b>
            <br />
            <br />
            Your Polyjuice address: <b>{polyjuiceAddress || ' - '}</b>
            <br />
            <br />
            Nervos Layer 2 balance:{' '}
            <b>{l2Balance ? (l2Balance / 10n ** 8n).toString() : <LoadingIndicator />} CKB</b>
            <br />
            <br />
            ckETH: <b>{ckEth ? format(ckEth.toString(), 18) : <LoadingIndicator />} ckETH</b>
            <br />
            <br />
            SUDT: <b>{sudt ? (sudt as number) : <LoadingIndicator />}</b>
            <br />
            <br />
            Newly deployed contract address: <b>{contract?.address || '-'}</b> <br />
            <br />
            <br />
            <div className="deposit">
                <h2>Deposit to Layer2</h2>
                {!layer2DepositAddress && (
                    <button onClick={getLayer2DepositAddress}>
                        Show My Layer2 Deposit Address
                    </button>
                )}

                {layer2DepositAddress && (
                    <div
                        className="deposit-address"
                        style={{
                            width: '50vw',
                            wordWrap: 'break-word',
                            overflowWrap: 'break-word'
                        }}
                    >
                        <p> {layer2DepositAddress}</p>
                        <br />
                        <ul>
                            <li>
                                <small>
                                    Copy the address above and go to Force Bridge to Deposit
                                </small>
                            </li>
                        </ul>
                        <button onClick={() => window.open(FORCE_BRIDGE_URL, '_blank')}>
                            Deposit via Force Bridge
                        </button>
                    </div>
                )}
            </div>
            <br />
            <br />
            <hr />
            <p>Deploy new contract or use existing contract</p>
            <button onClick={deployContract} disabled={!l2Balance}>
                Deploy contract
            </button>
            &nbsp;or&nbsp;
            <input
                placeholder="Existing contract id"
                onChange={e => setExistingContractIdInputValue(e.target.value)}
            />
            <button
                disabled={!existingContractIdInputValue || !l2Balance}
                onClick={() => setExistingContractAddress(existingContractIdInputValue)}
            >
                Use existing contract
            </button>
            <hr />
            <br />
            <br />
            <br />
            <input
                placeholder="Type name..."
                onChange={e => setTypedName(e.target.value)}
                value={typedName}
            />
            <button onClick={createNewName}>Create New Name</button>
            <br />
            <br />
            <div>
                <ul>
                    {loading && <LoadingIndicator />}
                    {names?.length < 1 && <small>No name found</small>}
                    {!loading && names?.map(name => <li key={name.id}>{name.name}</li>)}
                </ul>
            </div>
            <ToastContainer />
        </div>
    );
}
