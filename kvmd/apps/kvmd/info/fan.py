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


import copy
import asyncio

from typing import Dict
from typing import AsyncGenerator
from typing import Optional

import aiohttp

from ....logging import get_logger

from .... import aiotools
from .... import htclient

from ..sysunit import get_service_status

from .base import BaseInfoSubmanager


# =====
class FanInfoSubmanager(BaseInfoSubmanager):
    def __init__(
        self,
        daemon: str,
        unix_path: str,
        timeout: float,
        state_poll: float,
    ) -> None:

        self.__daemon = daemon
        self.__unix_path = unix_path
        self.__timeout = timeout
        self.__state_poll = state_poll

    async def get_state(self) -> Dict:
        monitored = await self.__get_monitored()
        return {
            "monitored": monitored,
            "state": ((await self.__get_fan_state() if monitored else None)),
        }

    async def poll_state(self) -> AsyncGenerator[Dict, None]:
        prev_state: Dict = {}
        while True:
            if self.__unix_path:
                pure = state = await self.get_state()
                if pure["state"] is not None:
                    try:
                        pure = copy.deepcopy(state)
                        pure["state"]["service"]["now_ts"] = 0
                    except Exception:
                        pass
                if pure != prev_state:
                    yield state
                    prev_state = pure
                await asyncio.sleep(self.__state_poll)
            else:
                yield (await self.get_state())
                await aiotools.wait_infinite()

    # =====

    async def __get_monitored(self) -> bool:
        if self.__unix_path:
            status = await aiotools.run_async(get_service_status, self.__daemon)
            if status is not None:
                return (status[0] or status[1])
        return False

    async def __get_fan_state(self) -> Optional[Dict]:
        try:
            async with self.__make_http_session() as session:
                async with session.get("http://localhost/state") as response:
                    htclient.raise_not_200(response)
                    return (await response.json())["result"]
        except Exception as err:
            get_logger(0).error("Can't read fan state: %s", err)
            return None

    def __make_http_session(self) -> aiohttp.ClientSession:
        kwargs: Dict = {
            "headers": {
                "User-Agent": htclient.make_user_agent("KVMD"),
            },
            "timeout": aiohttp.ClientTimeout(total=self.__timeout),
            "connector": aiohttp.UnixConnector(path=self.__unix_path)
        }
        return aiohttp.ClientSession(**kwargs)
