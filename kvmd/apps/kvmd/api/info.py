# ========================================================================== #
#                                                                            #
#    KVMD - The main PiKVM daemon.                                           #
#                                                                            #
#    Copyright (C) 2018-2022  Maxim Devaev <mdevaev@gmail.com>               #
#                                                                            #
#    This program is free software: you can redistribute it and/or modify    #
#    it under the terms of the GNU General Public License as published by    #
#    the Free Software Foundation, either version 3 of the License, or       #
#    (at your option) any later version.                                     #
#                                                                            #
#    This program is distributed in the hope that it will be useful,         #
#    but WITHOUT ANY WARRANTY; without even the implied warranty of          #
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the           #
#    GNU General Public License for more details.                            #
#                                                                            #
#    You should have received a copy of the GNU General Public License       #
#    along with this program.  If not, see <https://www.gnu.org/licenses/>.  #
#                                                                            #
# ========================================================================== #


import asyncio
import os
import subprocess

from typing import List

from aiohttp.web import Request
from aiohttp.web import Response

from ....htserver import exposed_http
from ....htserver import make_json_response

from ....validators.kvm import valid_info_fields

from ..info import InfoManager




# =====
class InfoApi:
    def __init__(self, info_manager: InfoManager) -> None:
        self.__info_manager = info_manager

    # =====

    @exposed_http("GET", "/info")
    async def __common_state_handler(self, request: Request) -> Response:
        fields = self.__valid_info_fields(request)
        results = dict(zip(fields, await asyncio.gather(*[
            self.__info_manager.get_submanager(field).get_state()
            for field in fields
        ])))
        return make_json_response(results)
    
    @exposed_http("GET", "/node_status")
    async def __common_get_nodestatus(self, request: Request) -> Response:
        status, data = subprocess.getstatusoutput('nodstatus')
        node_data_list = data.split('\n')
        res = {}
        for node_data in node_data_list:
            key = node_data.split(' ')[1]
            if key not in res:
                res[key] = self.__parse_node_status(node_data)
        return make_json_response(res)

    def __parse_node_status(self, line):
        if "OFF" in line:
            return "OFF"
        elif "ON" in line:
            return "ON"
        else:
            return "N/A" 

    @exposed_http("GET", "/netstat")
    async def __common_get_netstat(self, request: Request) -> Response:
        status, data = subprocess.getstatusoutput('sudo netcfg')
        if status == 0:
            res = self.__parse_netcfg(data)
        else:
            res = {'error': str(data)}
        return make_json_response(
            res
        )
    
    @exposed_http("POST", "/netstat")
    async def __common_set_netstat(self, request: Request) -> Response:
        data = {}
        try:
            command = "sudo netcfg ip {}".format(request.query.get('address'))
            status, res = subprocess.getstatusoutput(command)
            command = "sudo netcfg mask {}".format(request.query.get('mask'))
            status, res = subprocess.getstatusoutput(command)
            command = "sudo netcfg gw {}".format(request.query.get('gateway'))
            status, res = subprocess.getstatusoutput(command)
            command = "sudo netcfg dns {}".format(request.query.get('dns'))
            status, res = subprocess.getstatusoutput(command)
            data['status'] = status
            data['res'] = res
        except Exception as e:
            data['error'] = str(e)
        return make_json_response(data)
    
    @exposed_http("POST", "/password")
    async def __common_modify_password(self, request: Request) -> Response:
        data = {}
        user_name = request.query.get('username')
        password = request.query.get('password')
        try:
            command = "sudo kvmd-htpasswd set -p={} {}".format(password, user_name)
            status, res = subprocess.getstatusoutput(command)
            data['status'] = status
            data['res'] = res
        except Exception as e:
            data['error'] = str(e)
        return make_json_response(data)
    
    @exposed_http("POST", "/chassis_open")
    async def __common_open_chassis(self, request: Request) -> Response:
        data = {}
        try:
            command = "sudo crpspwr on"
            status, res = subprocess.getstatusoutput(command)
            data['status'] = status
            data['res'] = res
        except Exception as e:
            data['error'] = str(e)
        return make_json_response(data)
    
    @exposed_http("POST", "/chassis_close")
    async def __common_close_chassis(self, request: Request) -> Response:
        data = {}
        try:
            command = "sudo crpspwr off"
            status, res = subprocess.getstatusoutput(command)
            data['status'] = status
            data['res'] = res
        except Exception as e:
            data['error'] = str(e)
        return make_json_response(data)
    
    @exposed_http("GET", "/chassis_status")
    async def __common_get_chassis_status(self, request: Request) -> Response:
        data = {}
        try:
            command = "sudo crpspwr status"
            status, res = subprocess.getstatusoutput(command)
            data['chassis_status'] = 'ON' if 'ON' in res else 'OFF'
            command = "kvmstatus"
            status, res = subprocess.getstatusoutput(command)
            if status != 0:
                data['error'] = res
                data['kvm_status'] = 1
            else:
                data['kvm_status'] = res
            data['status'] = status
        except Exception as e:
            data['error'] = str(e)

        return make_json_response(data)
    
    @exposed_http("GET", "/chassis_type")
    async def __common_get_node_num(self, request: Request) -> Response:
        data = {}
        if not os.path.exists('/etc/chassis_type'):
            num = 4
        with open('/etc/chassis_type', 'rb') as f:
            res = f.read()
            num = int(res.decode().split('u')[1])
        data['num'] = num
        data['res'] = self.__get_node_status()
        return make_json_response(data)
    
    @exposed_http("POST", "/open_node")
    async def __node_open(self, request: Request) -> Response:
        data = {}
        try:
            num = request.query.get('num')
            command = "sudo nodpwron {}".format(num)
            status, res = subprocess.getstatusoutput(command)
            data['status'] = status
            data['res'] = res
        except Exception as e:
            data['error'] = str(e)
        return make_json_response(data)

    @exposed_http("POST", "/enable_node")
    async def __node_enable(self, request: Request) -> Response:
        data = {}
        try:
            num = request.query.get('num')
            command = "sudo nodenable {}".format(num)
            status, res = subprocess.getstatusoutput(command)
            data['status'] = status
            data['res'] = res
        except Exception as e:
            data['error'] = str(e)
        return make_json_response(data)
    
    @exposed_http("POST", "/disable_node")
    async def __node_disable(self, request: Request) -> Response:
        data = {}
        try:
            num = request.query.get('num')
            command = "sudo noddisable {}".format(num)
            status, res = subprocess.getstatusoutput(command)
            data['status'] = status
            data['res'] = res
        except Exception as e:
            data['error'] = str(e)
        return make_json_response(data)
    
    @exposed_http("POST", "/reset_node")
    async def __node_reset(self, request: Request) -> Response:
        data = {}
        try:
            num = request.query.get('num')
            command = "sudo nodrst {}".format(num)
            status, res = subprocess.getstatusoutput(command)
            data['status'] = status
            data['res'] = res
        except Exception as e:
            data['error'] = str(e)
        return make_json_response(data)
    
    @exposed_http("POST", "/kvm_node")
    async def __node_kvm(self, request: Request) -> Response:
        data = {}
        try:
            num = request.query.get('num')
            command = "sudo kvmport {}".format(num)
            status, res = subprocess.getstatusoutput(command)
            data['status'] = status
            data['res'] = res
        except Exception as e:
            data['error'] = str(e)
        return make_json_response(data)
    
    @exposed_http("POST", "/close_node")
    async def __node_close(self, request: Request) -> Response:
        data = {}
        try:
            num = request.query.get('num')
            command = "sudo nodpwroff {}".format(num)
            status, res = subprocess.getstatusoutput(command)
            data['status'] = status
            data['res'] = res
        except Exception as e:
            data['error'] = str(e)
        return make_json_response(data)
    
    def __exchange_maskint(self, mask_int):
        bin_arr = ['0' for i in range(32)]
        for i in range(mask_int):
            bin_arr[i] = '1'
        tmp_mask = [''.join(bin_arr[i*8: i*8 + 8]) for i in range(4)]
        tmp_mask = [str(int(tmpstr, 2)) for tmpstr in tmp_mask]
        return '.'.join(tmp_mask)

    def __exchange_maskstr(self, mask_str):
        return sum([bin(int(i)).count('1') for i in mask_str.split('.')])

    def __parse_netcfg(self, data):
        res = {
            'Name': '',
            'Address': '',
            'Gateway': '',
            'DNS': ''
        }
        mask = ''
        items = data.split('\n')
        for item in items:
            for key in list(res.keys()):
                if item.startswith(key):
                    res[key] = item.split('=')[1]
                    if key == "Address":
                        value = res[key]
                        res[key] = value.split('/')[0]
                        mask = self.__exchange_maskint(int(value.split('/')[1]))
        res['Mask'] = mask
        return res

    def __valid_info_fields(self, request: Request) -> List[str]:
        subs = self.__info_manager.get_subs()
        return sorted(valid_info_fields(
            arg=request.query.get("fields", ",".join(subs)),
            variants=subs,
        ) or subs)

    def __get_node_status(self):
        res = {}
        command = "nodstatus"
        status, data = subprocess.getstatusoutput(command)
        if status == 0:
            index = 1
            temps = data.split('\n')
            for temp in temps:
                if 'ON' in temp:
                    res[index] = 'ON'
                elif 'OFF' in temp:
                    res[index] = 'OFF'
                else:
                    res[index] = 'N/A'
                index += 1
        return res
