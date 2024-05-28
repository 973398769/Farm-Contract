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