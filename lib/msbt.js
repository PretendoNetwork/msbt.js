const fs = require('fs');

const MSBT_MAGIC = 'MsgStdBn';
const BIG_ENDIAN = Buffer.from('FEFF', 'hex');
const LITTLE_ENDIAN = Buffer.from('FFFE', 'hex');
const NULL_TERM = Buffer.from('0000', 'hex');

class MSBT {
	constructor(pathOrBuffer) {
		this.file;
		this.pos = 0;
		this.bom;
		this.numberSections;
		this.fileSize;
		this.lbl1 = {
			labels: []
		};
		this.txt2 = {
			messages: []
		};
		this.atr1 = [];
		this.tsy1 = [];
		this.nli1 = [];

		if (typeof pathOrBuffer === 'string') {
			this.file = fs.readFileSync(pathOrBuffer);
		} else {
			this.file = pathOrBuffer;
		}

		this.parse();
	}

	seek(pos) {
		this.pos = pos;
	}

	skip(length) {
		this.seek(this.pos+length);
	}

	readBuffer(length) {
		return this.file.subarray(this.pos, this.pos += length)
	}

	readString(length) {
		return this.readBuffer(length).toString();
	}

	readByte() {
		const read = this.file.readUInt8(this.pos);

		this.pos += 1;

		return read;
	}

	readUInt16() {
		let read;

		if (this.bom.equals(BIG_ENDIAN)) {
			read = this.file.readUInt16BE(this.pos);
		} else if (this.bom.equals(LITTLE_ENDIAN)) {
			read = this.file.readUInt16LE(this.pos);
		}

		this.pos += 2;

		return read;
	}

	readUInt32() {
		let read;

		if (this.bom.equals(BIG_ENDIAN)) {
			read = this.file.readUInt32BE(this.pos);
		} else if (this.bom.equals(LITTLE_ENDIAN)) {
			read = this.file.readUInt32LE(this.pos);
		}

		this.pos += 4;

		return read;
	}

	parse() {
		const magic = this.readString(0x8);

		if (magic !== MSBT_MAGIC) {
			throw new Error('Wrong magic');
		}

		this.bom = this.readBuffer(0x2);
		this.skip(0x2); // Unknown. Always 0x0000
		this.skip(0x2); // Unknown. Always 0x0103
		this.numberSections = this.readUInt16();
		this.skip(0x2); // Unknown. Always 0x0000
		this.fileSize = this.readUInt32();
		this.skip(10); // Unknown. Always 0

		for (let i = 0; i < this.numberSections; i++) {
			const sectionMagic = this.readString(0x4);
			const sectionSize = this.readUInt32();
			this.skip(0x8); // Unknown. Always 0

			const base = this.pos;

			switch (sectionMagic) {
				case 'LBL1':
					this.parseLBL1();
					break;

				case 'ATR1':
					this.parseATR1();
					break;

				case 'TXT2':
					this.parseTXT2();
					break;

				case 'TSY1':
					this.parseTSY1();
					break;
				default:
					console.log(sectionMagic)
					throw new Error('Invalid section magic');
			}

			let endpos = base + sectionSize;
			endpos += 0x10 - (endpos % 0x10 || 0x10);

			this.seek(endpos);
		}
	}

	parseLBL1() {
		const base = this.pos;

		const numberHashTableSlots = this.readUInt32();

		for (let i = 0; i < numberHashTableSlots; i++) {
			const numberOfLabels = this.readUInt32();
			const labelOffset = this.readUInt32();

			const tmpPos = this.pos;
			this.seek(base + labelOffset);

			for (let i = 0; i < numberOfLabels; i++) {
				const length = this.readByte();
				const label = this.readString(length);
				const id = this.readUInt32();

				this.lbl1.labels.push({ label, id});
			}

			this.seek(tmpPos);
		}
	}

	parseATR1() {
		const base = this.pos;
		const messageCount = this.readUInt32(); // * Should be same as LBL1
		const attributeSize = this.readUInt32();

		if (attributeSize > 0) {
			for (let i = 0; i < messageCount; i++) {
				const attributeOffset = this.readUInt32();
				const tmpPos = this.pos;

				this.seek(base + attributeOffset);

				const attribute = this.file.subarray(this.pos, this.pos + attributeSize);

				this.atr1.push(attribute);

				this.seek(tmpPos);
			}
		}
	}

	parseTXT2() {
		const base = this.pos;
		const messageCount = this.readUInt32();

		for (let i = 0; i < messageCount; i++) {
			const messageOffset = this.readUInt32();
			const chars = [];

			const tmpPos = this.pos;
			this.seek(base + messageOffset);

			while (!this.file.subarray(this.pos, this.pos + 2).equals(NULL_TERM)) {
				const char = this.readByte();
				chars.push(char);
			}

			let charBuffer = Buffer.from(chars);

			if (this.bom.equals(BIG_ENDIAN)) {
				charBuffer = charBuffer.swap16();
			}

			this.txt2.messages.push(charBuffer.toString('utf16le'));

			this.seek(tmpPos);
		}
	}

	parseTSY1() {

	}
}

module.exports = MSBT;