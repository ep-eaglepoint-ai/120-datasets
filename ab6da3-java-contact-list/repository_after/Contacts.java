import java.util.HashMap;
import java.util.Scanner;
 
public class Contacts {
 
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
 
        int n = in.nextInt();
        TrieNode root = new TrieNode();
 
        for (int i = 0; i < n; i++) {
            String op = in.next();
            String contact = in.next();
 
            if ("add".equals(op)) {
                addWord(root, contact);
            } else if ("find".equals(op)) {
                System.out.println(findWord(root, contact));
            }
        }
    }
 
    private static void addWord(TrieNode root, String word) {
        TrieNode current = root;
        current.prefixCount++;
 
        for (int i = 0; i < word.length(); i++) {
            char c = word.charAt(i);
            TrieNode next = current.children.get(c);
            if (next == null) {
                next = new TrieNode();
                current.children.put(c, next);
            }
            current = next;
            current.prefixCount++;
        }
    }
 
    private static int findWord(TrieNode root, String prefix) {
        TrieNode current = root;
 
        for (int i = 0; i < prefix.length(); i++) {
            char c = prefix.charAt(i);
            TrieNode next = current.children.get(c);
            if (next == null) {
                return 0;
            }
            current = next;
        }
 
        return current.prefixCount;
    }
 
    private static final class TrieNode {
        private int prefixCount = 0;
        private final HashMap<Character, TrieNode> children = new HashMap<>();
    }
}
