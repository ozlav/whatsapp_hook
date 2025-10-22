/**
 * Message Parser Tests
 * Tests for WhatsApp message parsing and reply detection
 */

import {
  isReplyMessage,
  extractQuotedMessageId,
  extractMessageText,
  extractSenderName,
  extractMessageId,
  extractRemoteJid,
  isFromTargetGroup
} from '../src/lib/messageParser';

describe('Message Parser', () => {
  const targetGroupId = '120363418663151479@g.us';

  describe('isReplyMessage', () => {
    it('should detect reply message with contextInfo.stanzaId', () => {
      const payload = {
        data: {
          contextInfo: {
            stanzaId: 'parent_message_id_123'
          }
        }
      };
      expect(isReplyMessage(payload)).toBe(true);
    });

    it('should detect non-reply message without contextInfo', () => {
      const payload = {
        data: {
          message: {
            conversation: 'Hello world'
          }
        }
      };
      expect(isReplyMessage(payload)).toBe(false);
    });

    it('should detect non-reply message with null contextInfo', () => {
      const payload = {
        data: {
          contextInfo: null,
          message: {
            conversation: 'Hello world'
          }
        }
      };
      expect(isReplyMessage(payload)).toBe(false);
    });

    it('should handle malformed payload gracefully', () => {
      expect(isReplyMessage(null)).toBe(false);
      expect(isReplyMessage(undefined)).toBe(false);
      expect(isReplyMessage({})).toBe(false);
    });
  });

  describe('extractQuotedMessageId', () => {
    it('should extract quoted message ID from reply', () => {
      const payload = {
        data: {
          contextInfo: {
            stanzaId: 'parent_message_id_123'
          }
        }
      };
      expect(extractQuotedMessageId(payload)).toBe('parent_message_id_123');
    });

    it('should return null for non-reply message', () => {
      const payload = {
        data: {
          message: {
            conversation: 'Hello world'
          }
        }
      };
      expect(extractQuotedMessageId(payload)).toBe(null);
    });

    it('should handle malformed payload gracefully', () => {
      expect(extractQuotedMessageId(null)).toBe(null);
      expect(extractQuotedMessageId(undefined)).toBe(null);
    });
  });

  describe('extractMessageText', () => {
    it('should extract text from conversation message', () => {
      const payload = {
        data: {
          message: {
            conversation: 'Hello world'
          }
        }
      };
      expect(extractMessageText(payload)).toBe('Hello world');
    });

    it('should extract text from extendedTextMessage', () => {
      const payload = {
        data: {
          message: {
            extendedTextMessage: {
              text: 'This is a long message'
            }
          }
        }
      };
      expect(extractMessageText(payload)).toBe('This is a long message');
    });

    it('should extract text from imageMessage caption', () => {
      const payload = {
        data: {
          message: {
            imageMessage: {
              caption: 'Image caption text'
            }
          }
        }
      };
      expect(extractMessageText(payload)).toBe('Image caption text');
    });

    it('should return empty string for message without text', () => {
      const payload = {
        data: {
          message: {
            imageMessage: {}
          }
        }
      };
      expect(extractMessageText(payload)).toBe('');
    });

    it('should handle malformed payload gracefully', () => {
      expect(extractMessageText(null)).toBe('');
      expect(extractMessageText(undefined)).toBe('');
      expect(extractMessageText({})).toBe('');
    });
  });

  describe('extractSenderName', () => {
    it('should extract sender name from pushName', () => {
      const payload = {
        data: {
          pushName: 'John Doe'
        }
      };
      expect(extractSenderName(payload)).toBe('John Doe');
    });

    it('should return Unknown for missing pushName', () => {
      const payload = {
        data: {
          message: {
            conversation: 'Hello'
          }
        }
      };
      expect(extractSenderName(payload)).toBe('Unknown');
    });

    it('should handle malformed payload gracefully', () => {
      expect(extractSenderName(null)).toBe('Unknown');
      expect(extractSenderName(undefined)).toBe('Unknown');
    });
  });

  describe('extractMessageId', () => {
    it('should extract message ID from key.id', () => {
      const payload = {
        data: {
          key: {
            id: 'message_123'
          }
        }
      };
      expect(extractMessageId(payload)).toBe('message_123');
    });

    it('should return empty string for missing key.id', () => {
      const payload = {
        data: {
          message: {
            conversation: 'Hello'
          }
        }
      };
      expect(extractMessageId(payload)).toBe('');
    });

    it('should handle malformed payload gracefully', () => {
      expect(extractMessageId(null)).toBe('');
      expect(extractMessageId(undefined)).toBe('');
    });
  });

  describe('extractRemoteJid', () => {
    it('should extract remote JID from key.remoteJid', () => {
      const payload = {
        data: {
          key: {
            remoteJid: '120363418663151479@g.us'
          }
        }
      };
      expect(extractRemoteJid(payload)).toBe('120363418663151479@g.us');
    });

    it('should return empty string for missing key.remoteJid', () => {
      const payload = {
        data: {
          message: {
            conversation: 'Hello'
          }
        }
      };
      expect(extractRemoteJid(payload)).toBe('');
    });
  });

  describe('isFromTargetGroup', () => {
    it('should return true for message from target group', () => {
      const remoteJid = targetGroupId;
      expect(isFromTargetGroup(remoteJid, targetGroupId)).toBe(true);
    });

    it('should return false for message from different group', () => {
      const remoteJid = '120363999999999999@g.us';
      expect(isFromTargetGroup(remoteJid, targetGroupId)).toBe(false);
    });

    it('should return false for missing remoteJid', () => {
      const remoteJid = '';
      expect(isFromTargetGroup(remoteJid, targetGroupId)).toBe(false);
    });
  });

  describe('Real-world payload examples', () => {
    it('should handle typical non-reply message', () => {
      const payload = {
        data: {
          key: {
            id: '3EB0C767D26B5A6B5A6B',
            remoteJid: '120363418663151479@g.us'
          },
          pushName: 'John Doe',
          message: {
            conversation: 'Work order #12345 for 123 Main St, $500 total'
          }
        }
      };

      expect(isReplyMessage(payload)).toBe(false);
      expect(extractMessageText(payload)).toBe('Work order #12345 for 123 Main St, $500 total');
      expect(extractSenderName(payload)).toBe('John Doe');
      expect(extractMessageId(payload)).toBe('3EB0C767D26B5A6B5A6B');
      expect(isFromTargetGroup(payload.data.key.remoteJid, targetGroupId)).toBe(true);
    });

    it('should handle typical reply message', () => {
      const payload = {
        data: {
          key: {
            id: '3EB0C767D26B5A6B5A6C',
            remoteJid: '120363418663151479@g.us'
          },
          pushName: 'Jane Smith',
          contextInfo: {
            stanzaId: '3EB0C767D26B5A6B5A6B'
          },
          message: {
            conversation: 'Update: job is done, status changed to completed'
          }
        }
      };

      expect(isReplyMessage(payload)).toBe(true);
      expect(extractQuotedMessageId(payload)).toBe('3EB0C767D26B5A6B5A6B');
      expect(extractMessageText(payload)).toBe('Update: job is done, status changed to completed');
      expect(extractSenderName(payload)).toBe('Jane Smith');
      expect(isFromTargetGroup(payload.data.key.remoteJid, targetGroupId)).toBe(true);
    });
  });
});
