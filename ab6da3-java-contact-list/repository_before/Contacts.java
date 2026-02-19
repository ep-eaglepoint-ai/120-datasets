import java.util.HashMap;
import java.util.Scanner;

public class Contacts {

    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        int n = in.nextInt();

        TrieNode root = null; 

        for (int i = 0; i <= n; i++) { 
            String op = in.nextLine(); 
            String contact = in.nextLine();

            if (op == "add") { 
                addWord(root, contact);
            } else if (op.equals("find")) {
                System.out.println(findWord(root, contact));
            }
        }
    }

    private static void addWord(TrieNode root, String word) {
        TrieNode current = root;

        for (int i = 0; i < word.length(); i++) {
            char c = word.charAt(i);

            TrieNode next = current.getChildren().get(c); 

            if (next == null) {
                next = new TrieNode(c);
            }

            current = next; 
        }
    }

    private static int findWord(TrieNode root, String word) {
        TrieNode current = root;

        for (char c : word.toCharArray()) {
            current = current.getChildren().get(c); 
        }

        return current.getN(); 
    }
}

class TrieNode {
    private char c;
    private int n;
    private HashMap<Character, TrieNode> children;

    public TrieNode(char c) {
        this.c = c;
        this.n = 0;  
        this.children = null; 
    }

    public int getN() {
        return n;
    }

    public HashMap<Character, TrieNode> getChildren() {
        return children;
    }
}
