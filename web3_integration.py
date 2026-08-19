"""Web3-Helfer fuer Wallets, Signaturen und Smart-Contract Zugriff."""

from __future__ import annotations

from dataclasses import dataclass

from eth_account import Account
from web3 import HTTPProvider, Web3

from errors import Web3IntegrationError


@dataclass(frozen=True)
class SignedTransactionResult:
    raw_transaction_hex: str
    transaction_hash_hex: str


class Web3Integration:
    """Basisintegration fuer Ethereum/Web3."""

    def __init__(self, provider_url: str | None = None):
        self.provider_url = provider_url or ""
        self._web3 = Web3(HTTPProvider(self.provider_url)) if self.provider_url else None

    @property
    def web3(self) -> Web3:
        if not self._web3:
            raise Web3IntegrationError("Kein Web3 Provider konfiguriert")
        return self._web3

    def is_connected(self) -> bool:
        return bool(self._web3 and self._web3.is_connected())

    @staticmethod
    def create_wallet() -> tuple[str, str]:
        account = Account.create()
        private_key = account.key.hex()
        if not private_key.startswith("0x"):
            private_key = f"0x{private_key}"
        return account.address, private_key

    def load_contract(self, address: str, abi: list[dict]):
        return self.web3.eth.contract(address=Web3.to_checksum_address(address), abi=abi)

    @staticmethod
    def sign_transaction(transaction: dict, private_key: str) -> SignedTransactionResult:
        try:
            signed = Account.sign_transaction(transaction, private_key)
            raw_transaction_hex = signed.raw_transaction.hex()
            transaction_hash_hex = signed.hash.hex()
            if not raw_transaction_hex.startswith("0x"):
                raw_transaction_hex = f"0x{raw_transaction_hex}"
            if not transaction_hash_hex.startswith("0x"):
                transaction_hash_hex = f"0x{transaction_hash_hex}"
            return SignedTransactionResult(
                raw_transaction_hex=raw_transaction_hex,
                transaction_hash_hex=transaction_hash_hex,
            )
        except Exception as exc:
            raise Web3IntegrationError("Transaktion konnte nicht signiert werden") from exc

    def get_eth_balance_wei(self, address: str) -> int:
        try:
            return int(self.web3.eth.get_balance(Web3.to_checksum_address(address)))
        except Exception as exc:
            raise Web3IntegrationError("Konnte ETH-Balance nicht laden") from exc
