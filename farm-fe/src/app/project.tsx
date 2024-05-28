import type { AppProps } from 'next/app'
import Router from 'next/router'
import { Row, Col, Statistic, message, Timeline, Modal, Input, Spin } from 'antd';
import { QuestionCircleOutlined, InfoCircleOutlined, CopyOutlined } from '@ant-design/icons';
const { Countdown } = Statistic;

import {
    ProjectData,
    RegistrationData,
    SaleData,
} from '@src/types'
import {
    STAKING_POOL_ID, tokenAbi
} from '@src/config'
import styles from './project.module.scss'
import TransactionButton from "@src/components/elements/TransactionButton";
import PoolCard from '@src/components/elements/PoolCard'
import ParticipateModal from '@src/containers/ParticipateModal/ParticipateModal';
import InviteModal from '@src/containers/InviteModal/InviteModal';
import { useEffect, useState, useMemo } from 'react'
import { formatDate, hexToBytes, parseEther, formatEther, parseWei, seperateNumWithComma } from "@src/util/index"
import axios from '@src/api/axios'
import { useWallet } from '@src/hooks/useWallet'
import { usePageLoading } from '@src/hooks/usePageLoading'
import { useErrorHandler } from '@src/hooks/useErrorHandler'
import { useResponsive } from '@src/hooks/useResponsive';

import {
    BigNumber, Contract, ethers
} from 'ethers'

import { useMessage } from '../hooks/useMessage'
import { useLogin } from '../hooks/useLoginModal'
import { useStake } from '../hooks/useStake'
import { useThirdParty } from '../hooks/useThirdParty';
import AppPopover from '@src/components/elements/AppPopover';
import { WarningOutlined, CheckCircleTwoTone } from '@ant-design/icons';

type OtherPoolInfoProps =
    {
        registration: RegistrationData,
        sale: SaleData,
    };

/**
 * Pool detail page
 */
export default function Pool({ Component, pageProps }: AppProps) {
    let search, params, pId;
    if (typeof window !== 'undefined') {
        search = window.location.search;
        params = new URLSearchParams(search);
        pId = params.get('id');
    }

    const {
        walletAddress,
        addToken,
        saleContract,
        saleAddress,
        setSaleAddress,
        setLoading,
        signer,
        chain,
    } = useWallet();

    const {
        setSuccessMessage,
        setErrorMessage
    } = useMessage();

    const {
        LoginModal,
        isUserRegister,
        showLoginModal,
        setLoginConfig,
        setLoginState,
    } = useLogin({ pId: pId });

    const {
        setDepositTokenAddress,
        depositedAmount,
        setStakingAddress,
        approve,
        stakingContract,
        depositDecimals,
        depositSymbol,
        setAllowanceAddress,
        allowance,
        globalPoolStakingAddress,
    } = useStake();

    useEffect(() => {
        setStakingAddress(globalPoolStakingAddress);
    }, [globalPoolStakingAddress])

    const {
        PageLoader,
        setPageLoading,
    } = usePageLoading();

    const {
        getErrorMessage,
    } = useErrorHandler();

    const {
        isDesktopOrLaptop,
        isTabletOrMobile,
    } = useResponsive();

    const [projectInfo, setProjectInfo] = useState<ProjectData>({} as ProjectData);
    const [tab, setTab] = useState('sale_info');
    // TODO: fix pool Id
    const [poolId, setPoolId] = useState<number>(STAKING_POOL_ID);
    const [statesReady, setStatesReady] = useState<boolean>(false);
    const [isRegistered, setIsRegistered] = useState<boolean>(false);
    const [canRegister, setCanRegister] = useState<boolean>(false);
    const [isParticipated, setIsParticipated] = useState<boolean>(false);
    const [participateAmount, setParticipateAmount] = useState();
    const [allocationTop, setAllocationTop] = useState();
    const [participateInfo, setParticipateInfo] = useState<any>();

    const [otherPoolInfo, setOtherPoolInfo] = useState<OtherPoolInfoProps>();
    const [mileStones, setMileStones] = useState<any>({})

    const [paymentTokenAddress, setPaymentTokenAddress] = useState<string>('');
    const [paymentTokenDecimal, setPaymentTokenDecimal] = useState<number>(18);


    // status: -1:not ready, 0: not started, 1: in registration,
    // 2: after registration and before participation,
    // 3: in sale,
    // 4: sale ended,
    const [status, setStatus] = useState(-1);

    const [showParticipateModal, setShowParticipateModal] = useState(false);

    const [referralCode, setReferralCode] = useState(null);
    const [referralModalVisible, setReferralModalVisible] = useState(false);

    const {
    } = useThirdParty();


    useEffect(() => {
        setPageLoading(true);

        // get projects info
        axios.get('/boba/product/base_info', { params: { productId: pId } })
            .then((response) => {
                let data = response.data || {};
                setProjectInfo(data);
                setLoginConfig({
                    tweetId: data.tweetId,
                    tgGroupLink: data.medias,
                    projectName: data.name,
                })
            })
            .catch((e) => {
                setErrorMessage('Network error, please check your network and refresh.')
            })
            .finally(() => {
                setPageLoading(false);
            })

        refreshStates();

        return (() => {
        })
    }, []);

    useEffect(() => {
        if (!walletAddress) {
            return;
        }
        // check whether has registered other projects
        axios.get('/boba/register/can_register', {
            params: { accountId: walletAddress }
        })
            .then((response) => {
                setCanRegister(true);
            })
            .catch((e) => {
                setCanRegister(false);
            })

        const referralCode = localStorage?.getItem('referral');
        if (referralCode) {
            bindReferral(referralCode);
        }
    }, [walletAddress])

    useEffect(() => {
        refreshStates();
    }, [saleContract, walletAddress])

    useEffect(() => {
        if (isRegistered && depositedAmount) {
            getParticipateAmount();
        } else {
        }
    }, [isRegistered, depositedAmount]);

    const amountBought: BigNumber = useMemo(() => {
        return participateInfo && BigNumber.from(participateInfo[0] as string) || BigNumber.from(0);
    }, [participateInfo])

    const amountETHPaid: BigNumber = useMemo(() => {
        return participateInfo && BigNumber.from(participateInfo[1] as string) || BigNumber.from(0);
    }, [participateInfo])

    const timeParticipated: number = useMemo(() => {
        return participateInfo && parseWei(participateInfo[2]) || 0;
    }, [participateInfo])

    const isPortionWithdrawn: Array<boolean> = useMemo(() => {
        return participateInfo && participateInfo[3] || 0;
    }, [participateInfo])

    // FIXME: should get vesting info from project api
    const vestingInfo = useMemo(() => {
        if (projectInfo && projectInfo.vestingPercentPerPortion && projectInfo.vestingPortionsUnlockTime) {
            return [projectInfo.vestingPercentPerPortion, projectInfo.vestingPortionsUnlockTime];
        } else {
            return [[], []];
        }
    }, [projectInfo]);

    const vestingPercentPerPortion: Array<number> = useMemo(() => {
        return vestingInfo && vestingInfo[0] || [];
    }, [vestingInfo]);

    const vestingPortionsUnlockTime: Array<number> = useMemo(() => {
        return vestingInfo && vestingInfo[1] || [];
    }, [vestingInfo]);

    const canWithdrawArr: Array<boolean> = useMemo(() => {
        if (vestingPortionsUnlockTime && isPortionWithdrawn) {
            return isPortionWithdrawn.map((canWithdraw, index) => {
                return !canWithdraw && (vestingPortionsUnlockTime[index] + '000') <= (Date.now() + '');
            })
        } else if (isPortionWithdrawn) {
            return isPortionWithdrawn.map(v => !v);
        } else {
            return [true];
        }
    }, [isPortionWithdrawn, status])

    useEffect(() => {
        const bigNumSec2Milsec = (bigSec) => {
            return (bigSec && (BigNumber.from(bigSec).toString())) || '';
        }
        if (projectInfo) {
            // init sale contract
            setSaleAddress(projectInfo.saleContractAddress);

            const mileStones = {
                registrationTimeStarts: bigNumSec2Milsec(projectInfo.registrationTimeStarts),
                registrationTimeEnds: bigNumSec2Milsec(projectInfo.registrationTimeEnds),
                saleStart: bigNumSec2Milsec(projectInfo.saleStart),
                saleEnd: bigNumSec2Milsec(projectInfo.saleEnd),
                unlock: bigNumSec2Milsec(projectInfo.unlockTime),
            }
            setMileStones(mileStones);
            setStatus(projectInfo.status);
            setPaymentTokenAddress(projectInfo.paymentToken);
        }
    }, [projectInfo, otherPoolInfo]);

    useEffect(() => {
        const timer = setInterval(() => {
            judgePoolStatus();
        }, 1000)
        return () => {
            clearInterval(timer);
        }
    }, [mileStones])

    /**
     * payment token contract
     */
    useEffect(() => {
        setDepositTokenAddress(paymentTokenAddress);
    }, [paymentTokenAddress])

    useEffect(() => {
        setAllowanceAddress(saleAddress);
    }, [saleAddress])

    function judgePoolStatus() {
        const now = Date.now();
        if (!mileStones) {
            return;
        }

        if (now < mileStones.registrationTimeStarts) {
            // not started
            setStatus(0);
        } else if (now < mileStones.registrationTimeEnds) {
            // in registration
            setStatus(1);
        } else if (now < mileStones.saleStart) {
            // before sale
            setStatus(2);
        } else if (now < mileStones.saleEnd) {
            // in sale
            setStatus(3);
        } else if (now < mileStones.unlock) {
            // sale ends
            setStatus(4);
        } else if (now >= mileStones.unlock) {
            // sale ends
            setStatus(5);
        }
    }

    function refreshStates() {
        if (!saleContract || !walletAddress) {
            return;
        }
        let option = { gasLimit: 100000 }
        let promiseA = saleContract.isRegistered(walletAddress, option)
            .then((data) => {
                setIsRegistered(data);
            })
            .catch(e => {
                console.error(e);
            });
        let promiseB = saleContract.isParticipated(walletAddress, option)
            .then((data) => {
                setIsParticipated(data);
                if (data) {
                    getParticipateInfo();
                }
            })
            .catch(e => {
                console.error(e);
            });
        Promise.all([promiseA, promiseB])
            .then(() => {
                setStatesReady(true);
            })
    }

    /**
     *
     * @returns Promise<string> - registration sign
     */
    function getRegistrationSign() {
        const f = new FormData();
        f.append('userAddress', walletAddress || '');
        f.append('contractAddress', saleAddress);

        return axios.post('/boba/encode/sign_registration', f)
            .then((response) => {
                let data = response.data;
                return data;
            })
            .catch(e => {
                // handle request error
                console.error(e);
                setErrorMessage('Register fail');
            })
    }
    /**
     *
     * @returns Promise<string> - participate sign
     */
    function getParticipateSign() {
        const NUMBER_1E18 = "1000000000000000000";

        const f = new FormData();
        f.append('userAddress', walletAddress || '');
        f.append('contractAddress', saleAddress);
        // FIXME: get Participate amount
        f.append('amount', allocationTop);
        return axios.post('/boba/encode/sign_participation', f)
            .then((response) => {
                let data = response.data;
                return data;
            })
            .catch(e => {
                // handle request error
                console.error(e);
                setErrorMessage('Purchase fail');
            })
    }
    /**
     * bind referral codes
     * @param referralcode
     * @returns
     */
    function bindReferral(referralcode) {
        const f = new FormData();
        f.append('referralCode', referralcode);
        f.append('participant', walletAddress);
        return axios.post('/boba/referral/bind', f)
    }

    /**
     * Register
     * @returns Promise
     */
    function registerForSale() {
        if (!isUserRegister) {
            showLoginModal();
            return;
        }
        if (!saleContract) {
            return Promise.reject();
        }
        return getRegistrationSign()
            .then((registrationSign) => {
                const signBuffer = hexToBytes(registrationSign);
                return saleContract.registerForSale(signBuffer, poolId)
                    .then(transaction => {
                        return transaction.wait();
                    })
                    .then(() => {
                        setSuccessMessage('Register success');
                        refreshStates();
                        return Promise.resolve();
                    })
                    .then(() => {
                        // on register success
                        const sendRegisterSuccess = async () => {
                            const referralCode = localStorage?.getItem('referral');
                            const f = new FormData();
                            f.append('accountId', walletAddress);
                            f.append('productId', pId);
                            f.append('referralCode', referralCode)
                            return axios.post('/boba/register/user_register', f).then(() => {
                                if (typeof window !== 'undefined') {
                                    window.localStorage.removeItem('referral');
                                }
                            })
                        }

                        function loop() {
                            setTimeout(() => {
                                sendRegisterSuccess()
                                    .catch(() => {
                                        loop();
                                    })
                            }, 3000)
                        }
                        loop();
                    })
                    .then(() => {
                        function loop() {
                            setTimeout(() => {
                                addRegisterAmount()
                                    .then(() => {
                                        getParticipateAmount();
                                    })
                                    .catch(() => {
                                        loop();
                                    })
                            }, 3000)
                        }
                        loop();
                    })
            })
            .catch(e => {
                setErrorMessage('Participate failed. ' + (getErrorMessage(e) || ''));
                console.error(e);
            })
    }

    function addRegisterAmount(amount?, productId?, accountId?) {
        const f = new FormData();
        Object.entries({ stakeAmount: amount || depositedAmount || 0, productId: productId || pId, accountId: accountId || walletAddress })
            .forEach(([key, value]) => {
                f.append(key, value as string);
            })
        return axios.post('/boba/amount/register/add', f)
            .then((response) => {
            })
            .catch((e) => {
                console.error(e);
            })
    }

    function getParticipateAmount() {
        let search = window.location.search;
        let params = new URLSearchParams(search);
        let pId = params.get('id');
        const f = new FormData();
        Object.entries({ accountId: walletAddress, productId: pId })
            .forEach(([key, value]) => {
                f.append(key, value as string);
            })
        return axios.post('/boba/amount/calc', f)
            .then((response) => {
                let data = response.data;
                setAllocationTop(data.amount.replace(/\..+$/g, ''));
                return data;
            })
    }
    /**
     * Participate project
     * @returns Promise
     */
    async function participate(value) {
        if (!saleContract) {
            return Promise.reject();
        }
        setLoading(true);
        // const decimals = await depositTokenContract.decimals();
        // const paymentAmount = BigNumber.from(projectInfo.tokenPriceInPT).mul(~~value.value).div(Math.pow(10, 18-decimals));
        const paymentAmount = BigNumber.from(projectInfo.tokenPriceInPT).mul(~~value.value);

        return approve(saleAddress, Number(ethers.utils.formatUnits(paymentAmount, depositDecimals)), depositDecimals)
            .then(() => {
                return getParticipateSign()
            })
            .then(async (participateSign) => {
                const signBuffer = hexToBytes(participateSign);

                // get participation value
                const options = {
                };
                return saleContract.participate(
                    signBuffer,
                    BigNumber.from(allocationTop + ''),
                    paymentAmount,
                    options
                )
                    .then((transaction) => {
                        return transaction.wait();
                    })
                    .then((transaction) => {
                        setSuccessMessage('Purchase success');
                        refreshStates();
                        setShowParticipateModal(false);
                        return Promise.resolve();
                    })
            })
            .catch((e) => {
                console.error(e);
                // if(e && e.code === -32603) {
                //   setErrorMessage('Purchase fail, it seems you don\'t have enough ETH tokens to pay, please check your balance.')
                //   return;
                // }
                let msg = getErrorMessage(e);
                setErrorMessage('Purchase fail. ' + (msg || ''));
                return;
            })
            .finally(() => {
                setLoading(false);
            })
    }

    function withdrawTokens() {
        if (!saleContract) {
            return Promise.reject();
        }
        // set protionId
        let portionIds = canWithdrawArr.map((canWithdraw, index) => {
            return canWithdraw ? index : -1;
        })
            .filter(v => v > -1);
        return saleContract.withdrawMultiplePortions(portionIds)
            .then(transaction => {
                return transaction.wait();
            })
            .then((transaction) => {
                setSuccessMessage('withdraw success');
                refreshStates();
                return Promise.resolve();
            })
            .catch((e) => {
                let msg = getErrorMessage(e);
                setErrorMessage('Withdraw fail. ' + (msg || ''));
            })
    }
