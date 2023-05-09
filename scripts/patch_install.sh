#!/bin/bash


#current_timestamp=$(date +"%s")
current_timestamp=bak

kvmd_path=/usr/lib/python3/dist-packages/kvmd/apps/kvmd/api
web_js_path=/usr/share/kvmd/web/share/js/kvm
web_path=/usr/share/kvmd/web/kvm

echo "补丁更新开始"
echo "开始备份原有文件"
cp -rv $kvmd_path/info.py $kvmd_path/info.py_$current_timestamp || exit -1
cp -rv $web_js_path/recorder.js $web_js_path/recorder.js_$current_timestamp || exit -1
cp -rv $web_path/index.html $web_path/index.html_$current_timestamp || exit -1

echo "更新补丁文件到系统"
cp -rv info.py $kvmd_path/ || exit -1
cp -rv recorder.js $web_js_path/ || exit -1
cp -rv index.html $web_path/ || exit -1

echo "重启kvmd服务"
systemctl restart kvmd
sleep 1
echo "补丁更新完成"
