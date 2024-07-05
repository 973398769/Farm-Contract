# 后端服务构建部署说明
## 0. 前置条件

需要确保在开发环境中安装好 jdk8, maven(3.6.3+) && docker(20.10.17+) 和 docker compose(高版本docker安装时自带,低版本需要自行安装)

## 1. 数据库

    MySQL 5.7.29

    存储引擎：INNODB
    字符集编码：utf8mb4


| 数据库名    | 用户名  | 密码   |
|---------|------| ------ |
| brewery | root | 123456 |



应用列表：

| 服务名           | 开放端口 |
|---------------|------|
| portal-api    | 8080 |
| MySQL（5.7.29） | 3306 |



## 2.本地构建 && 镜像打包：

### 2.1 构建 portal-api 服务镜像
    
    cd portal-api

    # 打包后端服务
    mvn package -Dmaven.test.skip=true

    # 构建容器镜像
    ./docker-build.sh

### 2.2 生成接口文档

    cd portal-api
    mvn -Dfile.encoding=UTF-8 smart-doc:html

    在 portal-api/docs/html 目录下生成 debug-all.html 文件，使用浏览器打开查看接口文档。
    
    在portal-api/docs/html-example目录下保存了一份示例，供前端调用。
    

文档示例：

![smart-doc-1.png](smart-doc-1.png)



### 2.3 配置修改

#### 2.3.1 新建配置文件    

    cd deployment/docker-env
    
    #复制
    cp portal-api.env.example portal-api.env

#### 2.3.2 修改配置文件 portal-api.env

配置样例如下:
```shell
SPRING_PROFILES_ACTIVE=dev
TZ=Asia/Shanghai

# 私钥
OWNER_PRIVATE_KEY=privatekey

# mysql 数据库配置
DB_HOST=brewery-mysql:3306
DB_NAME=brewery
DB_USERNAME=root
DB_PWD=123456

```

以上配置中，
OWNER_PRIVATE_KEY 的值需改为私钥内容。私钥格式：OWNER_PRIVATE_KEY=702b0c8d127e662aff3fbdba0e797b6598f50cc8712230be8791963412345678
DB_XXX 配置为数据库配置，无需修改，如果使用外部数据库可以自行改为对应配置内容。



### 2.4 启动服务

    docker compose up -d 
    或者
    docker-compose up -d  # 使用低版本docker时，单独安装的 docker-compose 时使用

    # 查看服务启动日志
    docker-compose logs -f

    
