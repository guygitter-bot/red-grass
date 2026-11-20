package app.kidzfinder;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(KidPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
