import type { AppProps } from 'next/app'

import Link from 'next/link'
import { Modal, Button, Card, Row, Col, Space } from 'antd'

import styles from './farming.module.scss'
import FarmingForm from '@src/containers/FarmingForm/FarmingForm'
import WalletButton from '@src/components/elements/WalletButton';
import BasicButton from '@src/components/elements/Button.Basic'
import { useWallet } from '@src/hooks/useWallet';
import { useStake } from '@src/hooks/useStake';
import { useResponsive } from '@src/hooks/useResponsive';
import farmConfigs from '@src/config/farms'
import { QuestionCircleOutlined } from '@ant-design/icons';

import {
    EARNED_TOKEN_ADDRESS,
} from '@src/config'
import { HelperLink } from '@src/util'

/**
 * Stake form page
 */
export default function Pools({ Component, pageProps }: AppProps) {
    const {
        isDesktopOrLaptop,
        isTabletOrMobile,
    } = useResponsive();

    