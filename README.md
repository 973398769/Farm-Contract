部署流程

1. 复制.env.example 到.env,修改PRIVATE_KEY, 要求arbitrum sepolia上有测试eth

2. 部署c2n token
`npx hardhat run scripts/deployment/deploy_c2n_token.js --network arb_sepoliaarb_sepolia`

3. 部署airdrop合约
`npx hardhat run scripts/deployment/deploy_airdrop_c2n.js --network arb_sepolia`

4. 修改前端地址，运行前端测试airdrop功能

进入前端目录c2n-fe，安装依赖
`yarn`

修改token地址和airdrop 地址为合约之前部署的两个地址

c2n-fe/src/config/index.js 中的
`AIRDROP_TOKEN`
`AIRDROP_CONTRACT`

运行项目
`yarn dev`

6. farm

修改c2n-contracts/scripts/deployment/deploy_farm.js
第7行startTS为3分钟之后（必须是当前时间之后，考虑上链网络延迟）

修改 c2n-fe/src/config/farms.js
depositTokenAddress和earnedTokenAddress为AIRDROP_TOKEN的地址
修改stakingAddress为部署的farm合约地址

部署完毕，可以使用账号体验farm功能