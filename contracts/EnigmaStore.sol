// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title EnigmaStore
/// @notice Stores file metadata with encrypted keys for user-controlled decryption.
contract EnigmaStore is ZamaEthereumConfig {
    struct FileRecord {
        string fileName;
        string encryptedHash;
        euint32 encryptedKey;
        uint256 createdAt;
    }

    mapping(address => FileRecord[]) private _files;

    event FileStored(address indexed user, uint256 indexed index, string fileName);

    function storeFile(
        string calldata fileName,
        string calldata encryptedHash,
        externalEuint32 encryptedKey,
        bytes calldata inputProof
    ) external {
        require(bytes(fileName).length > 0, "File name required");
        require(bytes(encryptedHash).length > 0, "Encrypted hash required");

        euint32 key = FHE.fromExternal(encryptedKey, inputProof);

        _files[msg.sender].push(
            FileRecord({
                fileName: fileName,
                encryptedHash: encryptedHash,
                encryptedKey: key,
                createdAt: block.timestamp
            })
        );

        FHE.allowThis(key);
        FHE.allow(key, msg.sender);

        emit FileStored(msg.sender, _files[msg.sender].length - 1, fileName);
    }

    function getFileCount(address user) external view returns (uint256) {
        return _files[user].length;
    }

    function getFileInfo(
        address user,
        uint256 index
    ) external view returns (string memory fileName, string memory encryptedHash, euint32 encryptedKey, uint256 createdAt) {
        require(index < _files[user].length, "Invalid index");
        FileRecord storage record = _files[user][index];
        return (record.fileName, record.encryptedHash, record.encryptedKey, record.createdAt);
    }
}
